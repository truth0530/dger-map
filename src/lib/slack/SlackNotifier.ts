/**
 * Slack Webhook 알림 유틸리티
 * - 장애/복구 알림 발송
 * - 쿨다운 기반 중복 방지
 * - 상태 리포트 발송
 */

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
}

interface SlackAttachment {
  color: string;
  blocks?: SlackBlock[];
}

type AlertType = 'failure' | 'recovery' | 'report';

interface CooldownEntry {
  timestamp: number;
  type: AlertType;
}

// 전역 쿨다운 상태 (서버 메모리)
const globalForSlack = global as unknown as {
  slackCooldown: Map<string, CooldownEntry>;
  lastApiStatus: boolean; // true = 정상, false = 장애
};

if (!globalForSlack.slackCooldown) {
  globalForSlack.slackCooldown = new Map();
}

if (globalForSlack.lastApiStatus === undefined) {
  globalForSlack.lastApiStatus = true; // 초기값: 정상
}

const COOLDOWN_MS = 30 * 60 * 1000; // 30분

export class SlackNotifier {
  private webhookUrl: string | undefined;
  private enabled: boolean;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;

    if (!this.enabled) {
      console.warn('[SlackNotifier] SLACK_WEBHOOK_URL이 설정되지 않음 - 알림 비활성화');
    }
  }

  /**
   * 쿨다운 확인 (중복 알림 방지)
   */
  private isInCooldown(key: string): boolean {
    const entry = globalForSlack.slackCooldown.get(key);
    if (!entry) return false;

    const elapsed = Date.now() - entry.timestamp;
    if (elapsed >= COOLDOWN_MS) {
      globalForSlack.slackCooldown.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 쿨다운 설정
   */
  private setCooldown(key: string, type: AlertType): void {
    globalForSlack.slackCooldown.set(key, {
      timestamp: Date.now(),
      type
    });
  }

  /**
   * Slack Webhook으로 메시지 발송
   */
  private async send(message: SlackMessage): Promise<boolean> {
    if (!this.enabled || !this.webhookUrl) {
      console.log('[SlackNotifier] 알림 비활성화 상태 - 메시지 스킵');
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        console.error(`[SlackNotifier] 발송 실패: HTTP ${response.status}`);
        return false;
      }

      console.log('[SlackNotifier] 알림 발송 성공');
      return true;
    } catch (error) {
      console.error('[SlackNotifier] 발송 오류:', error);
      return false;
    }
  }

  /**
   * API 장애 알림
   */
  async notifyFailure(details: {
    apiName: string;
    errorMessage: string;
    region?: string;
    timestamp?: Date;
  }): Promise<boolean> {
    const cooldownKey = `failure:${details.apiName}`;

    // 쿨다운 중이면 스킵
    if (this.isInCooldown(cooldownKey)) {
      console.log(`[SlackNotifier] 쿨다운 중 - ${details.apiName} 장애 알림 스킵`);
      return false;
    }

    // 이미 장애 상태면 스킵 (복구 없이 연속 장애)
    if (!globalForSlack.lastApiStatus) {
      console.log('[SlackNotifier] 이미 장애 상태 - 중복 알림 스킵');
      return false;
    }

    const time = (details.timestamp || new Date()).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    });

    const message: SlackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 API 장애 발생',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*API:*\n${details.apiName}` },
            { type: 'mrkdwn', text: `*시간:*\n${time}` },
            { type: 'mrkdwn', text: `*오류:*\n${details.errorMessage}` },
            { type: 'mrkdwn', text: `*지역:*\n${details.region || '전체'}` }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '📞 *문의처:* 국립중앙의료원 응급의료정보화팀 02-6362-3451'
          }
        }
      ]
    };

    const sent = await this.send(message);
    if (sent) {
      this.setCooldown(cooldownKey, 'failure');
      globalForSlack.lastApiStatus = false;
    }
    return sent;
  }

  /**
   * API 복구 알림
   */
  async notifyRecovery(details: {
    apiName: string;
    itemCount: number;
    region?: string;
    timestamp?: Date;
  }): Promise<boolean> {
    // 장애 상태가 아니었으면 복구 알림 불필요
    if (globalForSlack.lastApiStatus) {
      return false;
    }

    const time = (details.timestamp || new Date()).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    });

    const message: SlackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '✅ API 복구 완료',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*API:*\n${details.apiName}` },
            { type: 'mrkdwn', text: `*복구 시간:*\n${time}` },
            { type: 'mrkdwn', text: `*데이터 건수:*\n${details.itemCount}건` },
            { type: 'mrkdwn', text: `*지역:*\n${details.region || '전체'}` }
          ]
        }
      ]
    };

    const sent = await this.send(message);
    if (sent) {
      globalForSlack.lastApiStatus = true;
      // 복구 시 장애 쿨다운 해제
      globalForSlack.slackCooldown.delete(`failure:${details.apiName}`);
    }
    return sent;
  }

  /**
   * 상태 리포트 발송
   */
  async sendStatusReport(stats: {
    apiName: string;
    status: 'healthy' | 'degraded' | 'down';
    uptime24h?: number;
    lastCheck: Date;
    details?: string;
  }): Promise<boolean> {
    const cooldownKey = 'report:daily';

    // 리포트는 쿨다운 체크 없이 발송 (외부 cron에서 주기 관리)
    const statusEmoji = {
      healthy: '🟢',
      degraded: '🟡',
      down: '🔴'
    };

    const statusText = {
      healthy: '정상',
      degraded: '일부 장애',
      down: '장애'
    };

    const time = stats.lastCheck.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    });

    const message: SlackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 DGER API 상태 리포트',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*API:*\n${stats.apiName}` },
            { type: 'mrkdwn', text: `*상태:*\n${statusEmoji[stats.status]} ${statusText[stats.status]}` },
            { type: 'mrkdwn', text: `*확인 시간:*\n${time}` },
            ...(stats.uptime24h !== undefined
              ? [{ type: 'mrkdwn', text: `*24시간 가동률:*\n${stats.uptime24h.toFixed(1)}%` }]
              : [])
          ]
        },
        ...(stats.details
          ? [{
              type: 'section' as const,
              text: {
                type: 'mrkdwn' as const,
                text: `*상세:*\n${stats.details}`
              }
            }]
          : [])
      ]
    };

    return this.send(message);
  }

  /**
   * 현재 API 상태 확인
   */
  getLastApiStatus(): boolean {
    return globalForSlack.lastApiStatus;
  }

  /**
   * API 상태 수동 설정 (테스트용)
   */
  setApiStatus(status: boolean): void {
    globalForSlack.lastApiStatus = status;
  }
}

// 싱글톤 인스턴스
export const slackNotifier = new SlackNotifier();
