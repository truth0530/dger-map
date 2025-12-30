/**
 * 피드백 게시판 슬랙 알림 모듈
 *
 * 새 피드백이 작성되면 슬랙 채널로 알림을 전송합니다.
 */

export interface FeedbackNotificationData {
  id: string;
  author: string;
  category: '버그' | '건의' | '기타';
  content: string;
  isPublic: boolean;
  contact?: string;
  createdAt: string;
}

/**
 * 카테고리별 이모지와 색상
 */
const CATEGORY_CONFIG: Record<string, { emoji: string; color: string }> = {
  '버그': { emoji: ':bug:', color: '#ef4444' },
  '건의': { emoji: ':bulb:', color: '#3b82f6' },
  '기타': { emoji: ':speech_balloon:', color: '#6b7280' },
};

/**
 * 슬랙 Webhook을 통해 피드백 알림 전송
 */
export async function sendFeedbackNotification(
  data: FeedbackNotificationData
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[SlackNotification] SLACK_WEBHOOK_URL not configured, skipping notification');
    return false;
  }

  try {
    const config = CATEGORY_CONFIG[data.category] || CATEGORY_CONFIG['기타'];

    // 내용 미리보기 (최대 200자)
    const contentPreview = data.content.length > 200
      ? data.content.slice(0, 200) + '...'
      : data.content;

    // 비밀글 여부 표시
    const visibilityText = data.isPublic ? '공개' : ':lock: 비밀글';

    const payload = {
      text: `${config.emoji} 새 피드백이 등록되었습니다`,
      attachments: [
        {
          color: config.color,
          pretext: `DGER Map에 새 피드백이 등록되었습니다.`,
          author_name: data.author,
          author_icon: 'https://dger-map.vercel.app/favicon.ico',
          title: `[${data.category}] 피드백 #${data.id}`,
          title_link: `https://dger-map.vercel.app/feedback`,
          fields: [
            {
              title: '카테고리',
              value: `${config.emoji} ${data.category}`,
              short: true
            },
            {
              title: '공개여부',
              value: visibilityText,
              short: true
            },
            {
              title: '내용',
              value: data.isPublic ? contentPreview : '(비밀글입니다)',
              short: false
            },
            ...(data.contact ? [{
              title: '연락처',
              value: data.contact,
              short: true
            }] : [])
          ],
          footer: 'DGER Map 피드백 시스템',
          footer_icon: 'https://dger-map.vercel.app/favicon.ico',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SlackNotification] Failed to send feedback notification', {
        status: response.status,
        error: errorText,
        feedbackId: data.id
      });
      return false;
    }

    console.log('[SlackNotification] Feedback notification sent', {
      feedbackId: data.id,
      category: data.category
    });

    return true;
  } catch (error) {
    console.error('[SlackNotification] Error sending feedback notification', error);
    return false;
  }
}
