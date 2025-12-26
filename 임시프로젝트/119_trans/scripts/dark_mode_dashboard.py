#!/usr/bin/env python3
"""
다크모드 통합 대시보드
모든 그래프에 일관된 다크모드 테마 적용
"""

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import dash
from dash import dcc, html, Input, Output, callback
from dash import dash_table
import warnings
import numpy as np
warnings.filterwarnings('ignore')

# 병원사정 전원율 분석 모듈 임포트
from hospital_transfer_analyzer import HospitalTransferAnalyzer
from hospital_transfer_charts import HospitalTransferCharts

class DarkModeDashboard:
    def __init__(self):
        self.group1_file = "data/그룹1_응급진료결과_24개월_통합.xlsx"
        self.group2_file = "data/그룹2_119구급차전원율_24개월_통합.xlsx"
        self.group3_file = "data/그룹3_일일환자내역_통합.xlsx"

        # 다크모드 색상 팔레트
        self.dark_bg = '#1e1e1e'
        self.dark_grid = '#2d2d2d'
        self.dark_text = '#e0e0e0'
        self.accent_blue = '#4da6ff'
        self.accent_green = '#66bb6a'
        self.accent_red = '#ef5350'
        self.accent_orange = '#ffa726'
        self.accent_purple = '#ab47bc'

        # 다크모드 색상 배열 (차트용)
        self.dark_colors = [
            '#4da6ff',  # 파란색
            '#66bb6a',  # 녹색
            '#ffa726',  # 주황색
            '#ef5350',  # 빨강색
            '#ab47bc',  # 보라색
            '#29b6f6',  # 하늘색
            '#ec407a',  # 핑크색
            '#ff7043',  # 깊은 주황색
            '#7e57c2',  # 깊은 보라색
            '#26a69a'   # 청록색
        ]

        # 데이터 로드
        self.group1_df = self.load_group1_data()
        self.group2_df = self.load_group2_data()
        self.group3_df = self.load_group3_data()

        # 병원사정 전원율 분석 초기화
        self.hospital_transfer_analyzer = None
        self.hospital_transfer_charts = None
        self.hospital_transfer_df = None
        self.init_hospital_transfer_analysis()

        # Dash 앱 초기화
        self.app = dash.Dash(__name__)
        self.setup_layout()
        self.setup_callbacks()

    def apply_dark_theme(self, fig, title=None):
        """그래프에 다크모드 테마 적용"""
        fig.update_layout(
            template='plotly_dark',
            paper_bgcolor=self.dark_bg,
            plot_bgcolor=self.dark_grid,
            font=dict(
                family='Arial, sans-serif',
                size=12,
                color=self.dark_text
            ),
            title=dict(
                text=title if title else fig.layout.title.text,
                font=dict(size=16, color=self.dark_text),
                x=0.5,
                xanchor='center'
            ) if title or fig.layout.title.text else None,
            xaxis=dict(
                showgrid=True,
                gridwidth=1,
                gridcolor='#3d3d3d',
                showline=True,
                linewidth=1,
                linecolor='#505050',
                zeroline=False,
                tickcolor=self.dark_text
            ),
            yaxis=dict(
                showgrid=True,
                gridwidth=1,
                gridcolor='#3d3d3d',
                showline=True,
                linewidth=1,
                linecolor='#505050',
                zeroline=False,
                tickcolor=self.dark_text
            ),
            hovermode='x unified',
            margin=dict(l=60, r=40, t=60, b=50),
            height=500
        )

        # 범례 스타일 적용
        fig.update_layout(
            legend=dict(
                bgcolor='rgba(30, 30, 30, 0.8)',
                bordercolor='#505050',
                borderwidth=1,
                font=dict(color=self.dark_text)
            )
        )

        return fig

    def load_group1_data(self):
        """그룹1 데이터 로드"""
        try:
            df = pd.read_excel(self.group1_file, sheet_name='응급진료결과_통합')
            print(f"그룹1 데이터 로드 완료: {df.shape[0]} records")

            numeric_cols = ['전체', '귀가_증상호전', '전원_병실부족', '입원_일반병실', '사망_DOA']
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

            return df
        except Exception as e:
            print(f"그룹1 데이터 로드 실패: {e}")
            return pd.DataFrame()

    def load_group2_data(self):
        """그룹2 데이터 로드"""
        try:
            df = pd.read_excel(self.group2_file, sheet_name='119구급차전원율_통합')
            print(f"그룹2 데이터 로드 완료: {df.shape[0]} records")

            numeric_cols = ['119구급차_중증응급환자수', '119구급차_중증응급환자_전원수']
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

            return df
        except Exception as e:
            print(f"그룹2 데이터 로드 실패: {e}")
            return pd.DataFrame()

    def load_group3_data(self):
        """그룹3 데이터 로드"""
        try:
            df = pd.read_excel(self.group3_file, sheet_name='일일환자내역_통합', engine='openpyxl')
            print(f"그룹3 데이터 로드 완료: {df.shape[0]} records")

            date_columns = ['내원일시', '내원일', '접수일시', '접수일', '진료일시', '진료일']
            for col in date_columns:
                if col in df.columns:
                    df['내원일시'] = pd.to_datetime(df[col], errors='coerce')
                    break

            if '내원일시' not in df.columns:
                df['내원일시'] = pd.Timestamp.now()

            classification_columns = ['병원분류', '의료기관분류', '기관분류', '센터구분']
            for col in classification_columns:
                if col in df.columns:
                    df['병원분류'] = df[col]
                    break

            if '병원분류' not in df.columns:
                df['병원분류'] = '기관급'

            hospital_columns = ['추출병원명', '의료기관명', '병원명', '기관명']
            for col in hospital_columns:
                if col in df.columns:
                    df['추출병원명'] = df[col]
                    break

            if '추출병원명' not in df.columns:
                df['추출병원명'] = 'Unknown Hospital'

            return df
        except Exception as e:
            print(f"그룹3 데이터 로드 실패: {e}")
            return pd.DataFrame()

    def init_hospital_transfer_analysis(self):
        """병원사정 전원율 분석 초기화"""
        try:
            self.hospital_transfer_analyzer = HospitalTransferAnalyzer()
            if self.hospital_transfer_analyzer is not None:
                self.hospital_transfer_charts = HospitalTransferCharts(
                    self.hospital_transfer_analyzer
                )
                if hasattr(self.hospital_transfer_analyzer, 'df') and self.hospital_transfer_analyzer.df is not None:
                    self.hospital_transfer_df = self.hospital_transfer_analyzer.df.copy()
                print("[OK] 병원사정 분석 초기화 완료")
            else:
                print("[WARNING] 병원사정 분석 데이터를 로드할 수 없습니다")
        except Exception as e:
            print(f"[WARNING] 병원사정 분석 초기화 실패: {e}")

    def get_standard_region_order(self):
        """표준 지역 순서 반환"""
        return ['전체', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
                '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

    def setup_layout(self):
        """대시보드 레이아웃 설정"""
        print("setup_layout 시작")

        all_regions = self.get_standard_region_order()

        self.app.layout = html.Div([
            html.Div([
                html.H1("응급의료 통합 대시보드 (다크모드)",
                       style={
                           'text-align': 'center',
                           'color': self.dark_text,
                           'margin-bottom': '30px',
                           'font-weight': 'bold'
                       }),

                # 지역 선택
                html.Div([
                    html.Div([
                        html.Label("지역 선택:",
                                  style={
                                      'font-weight': 'bold',
                                      'margin-right': '10px',
                                      'display': 'inline-block',
                                      'line-height': '36px',
                                      'color': self.dark_text
                                  }),
                        dcc.Dropdown(
                            id='region-selector',
                            options=[{'label': region, 'value': region} for region in all_regions],
                            value='전체',
                            style={
                                'width': '200px',
                                'display': 'inline-block'
                            }
                        )
                    ], style={
                        'display': 'flex',
                        'align-items': 'center',
                        'justify-content': 'flex-end'
                    })
                ], style={'margin-bottom': '20px'}),

                # 탭 구성
                dcc.Tabs(
                    id='main-tabs',
                    value='overview',
                    children=[
                        dcc.Tab(label='전체 개요', value='overview'),
                        dcc.Tab(label='응급진료결과', value='group1'),
                        dcc.Tab(label='119 중증환자 전원율', value='group2'),
                        dcc.Tab(label='센터급 vs 기관급 분석', value='group3'),
                        dcc.Tab(label='월별 트렌드 비교', value='monthly_trends'),
                        dcc.Tab(label='지역별 심화 분석', value='regional_analysis'),
                        dcc.Tab(label='병원사정 전원분석', value='hospital_transfer_analysis')
                    ],
                    style={
                        'backgroundColor': self.dark_grid,
                        'borderBottom': f'2px solid {self.accent_blue}'
                    }
                ),

                # 탭 내용
                html.Div(
                    id='tab-content',
                    children=[
                        html.Div("콘텐츠 로딩 중...",
                                style={
                                    'text-align': 'center',
                                    'padding': '50px',
                                    'color': self.dark_text
                                })
                    ],
                    style={'margin-top': '20px'}
                )
            ], style={
                'padding': '20px',
                'backgroundColor': self.dark_bg,
                'color': self.dark_text,
                'minHeight': '100vh'
            })
        ], style={
            'backgroundColor': self.dark_bg,
            'color': self.dark_text
        })

    def setup_callbacks(self):
        """콜백 함수 설정 (단순화 - 원본 기능 유지)"""

        @self.app.callback(
            Output('tab-content', 'children'),
            [Input('main-tabs', 'value'),
             Input('region-selector', 'value')]
        )
        def render_content(active_tab, selected_region):
            try:
                print(f"render_content 호출: {active_tab}, {selected_region}")

                if active_tab == 'overview':
                    return self.render_overview(selected_region)
                elif active_tab == 'group1':
                    return self.render_group1(selected_region)
                elif active_tab == 'group2':
                    return self.render_group2(selected_region)
                elif active_tab == 'group3':
                    return self.render_group3(selected_region)
                elif active_tab == 'monthly_trends':
                    return self.render_monthly_trends(selected_region)
                elif active_tab == 'regional_analysis':
                    return self.render_regional_analysis()
                elif active_tab == 'hospital_transfer_analysis':
                    return self.render_hospital_transfer()

            except Exception as e:
                print(f"render_content 에러: {e}")
                import traceback
                traceback.print_exc()
                return html.Div(f"에러 발생: {str(e)}",
                               style={'color': self.accent_red, 'padding': '20px'})

    def render_overview(self, selected_region):
        """전체 개요 렌더링"""
        try:
            # 통계 계산
            group1_total_patients = self.group1_df['전체'].sum() if not self.group1_df.empty else 0
            group1_hospitals = self.group1_df['의료기관명'].nunique() if not self.group1_df.empty else 0

            group2_total_patients = self.group2_df['119구급차_중증응급환자수'].sum() if not self.group2_df.empty else 0
            group2_hospitals = self.group2_df['의료기관명'].nunique() if not self.group2_df.empty else 0

            group3_records = len(self.group3_df) if not self.group3_df.empty else 0

            date_range = "N/A"
            if not self.group1_df.empty and '연월' in self.group1_df.columns:
                date_range = f"{self.group1_df['연월'].min()} ~ {self.group1_df['연월'].max()}"

            return html.Div([
                html.H2("응급의료 통계 개요", style={'color': self.dark_text, 'text-align': 'center', 'margin-bottom': '30px'}),

                # 카드형 통계
                html.Div([
                    html.Div([
                        html.H3(f"{len(self.group1_df):,}",
                               style={'color': self.accent_blue, 'margin': '0', 'fontSize': '32px'}),
                        html.P("Group 1 레코드", style={'color': self.dark_text, 'margin': '10px 0 5px 0'}),
                        html.P(f"{group1_hospitals:,}개 기관", style={'color': '#aaa', 'margin': '0', 'fontSize': '12px'})
                    ], style={
                        'backgroundColor': self.dark_grid,
                        'padding': '30px',
                        'borderRadius': '8px',
                        'textAlign': 'center',
                        'flex': '1',
                        'margin': '10px',
                        'borderLeft': f'4px solid {self.accent_blue}'
                    }),

                    html.Div([
                        html.H3(f"{len(self.group2_df):,}",
                               style={'color': self.accent_green, 'margin': '0', 'fontSize': '32px'}),
                        html.P("Group 2 레코드", style={'color': self.dark_text, 'margin': '10px 0 5px 0'}),
                        html.P(f"{group2_hospitals:,}개 기관", style={'color': '#aaa', 'margin': '0', 'fontSize': '12px'})
                    ], style={
                        'backgroundColor': self.dark_grid,
                        'padding': '30px',
                        'borderRadius': '8px',
                        'textAlign': 'center',
                        'flex': '1',
                        'margin': '10px',
                        'borderLeft': f'4px solid {self.accent_green}'
                    }),

                    html.Div([
                        html.H3(f"{group3_records:,}",
                               style={'color': self.accent_orange, 'margin': '0', 'fontSize': '32px'}),
                        html.P("Group 3 레코드", style={'color': self.dark_text, 'margin': '10px 0 5px 0'}),
                        html.P("일일환자내역", style={'color': '#aaa', 'margin': '0', 'fontSize': '12px'})
                    ], style={
                        'backgroundColor': self.dark_grid,
                        'padding': '30px',
                        'borderRadius': '8px',
                        'textAlign': 'center',
                        'flex': '1',
                        'margin': '10px',
                        'borderLeft': f'4px solid {self.accent_orange}'
                    })
                ], style={
                    'display': 'flex',
                    'justifyContent': 'space-around',
                    'marginBottom': '30px',
                    'flexWrap': 'wrap'
                }),

                # 상세 통계
                html.Div([
                    html.H3("주요 통계", style={'color': self.dark_text, 'marginTop': '0'}),
                    html.Div([
                        html.Div([
                            html.Span("Group 1 총 환자수: ", style={'color': self.dark_text}),
                            html.Span(f"{group1_total_patients:,.0f}명", style={'color': self.accent_blue, 'fontWeight': 'bold', 'fontSize': '18px'})
                        ], style={'marginBottom': '15px'}),
                        html.Div([
                            html.Span("Group 2 총 환자수: ", style={'color': self.dark_text}),
                            html.Span(f"{group2_total_patients:,.0f}명", style={'color': self.accent_green, 'fontWeight': 'bold', 'fontSize': '18px'})
                        ], style={'marginBottom': '15px'}),
                        html.Div([
                            html.Span("데이터 기간: ", style={'color': self.dark_text}),
                            html.Span(date_range, style={'color': self.accent_blue, 'fontWeight': 'bold'})
                        ], style={'marginBottom': '0'})
                    ], style={'fontSize': '16px'})
                ], style={
                    'backgroundColor': self.dark_grid,
                    'padding': '25px',
                    'borderRadius': '8px',
                    'marginTop': '20px',
                    'borderLeft': f'4px solid {self.accent_blue}'
                })
            ], style={'padding': '20px'})
        except Exception as e:
            return html.Div(f"에러: {str(e)}", style={'color': self.accent_red, 'padding': '20px'})

    def render_group1(self, selected_region):
        """Group 1 데이터 렌더링"""
        return html.Div([
            html.H2("응급진료결과 분석", style={'color': self.dark_text}),
            html.Div([
                dcc.Graph(
                    figure=self.create_group1_monthly_chart(selected_region),
                    style={'marginTop': '20px'}
                )
            ])
        ], style={'padding': '20px'})

    def create_group1_monthly_chart(self, selected_region):
        """Group 1 월별 차트"""
        if self.group1_df.empty:
            return go.Figure().add_annotation(text="데이터 없음", xref="paper", yref="paper",
                                             x=0.5, y=0.5, showarrow=False,
                                             font=dict(color=self.dark_text))

        df = self.group1_df.copy()

        if selected_region != '전체':
            df = df[df['지역'] == selected_region]

        monthly = df.groupby('연월')['전체'].sum().reset_index()
        monthly = monthly.sort_values('연월')

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=monthly['연월'],
            y=monthly['전체'],
            mode='lines+markers',
            name='환자수',
            line=dict(color=self.accent_blue, width=3),
            marker=dict(size=8),
            hovertemplate='<b>%{x}</b><br>환자수: %{y:,.0f}명<extra></extra>'
        ))

        fig.update_layout(
            title=f"{selected_region} - 월별 응급진료 환자수",
            xaxis_title="월",
            yaxis_title="환자수",
            hovermode='x unified'
        )

        return self.apply_dark_theme(fig)

    def render_group2(self, selected_region):
        """Group 2 데이터 렌더링"""
        return html.Div([
            html.H2("119 중증환자 전원율 분석", style={'color': self.dark_text}),
            html.Div([
                dcc.Graph(
                    figure=self.create_group2_transfer_chart(selected_region),
                    style={'marginTop': '20px'}
                )
            ])
        ], style={'padding': '20px'})

    def create_group2_transfer_chart(self, selected_region):
        """Group 2 전원율 차트"""
        if self.group2_df.empty:
            return go.Figure().add_annotation(text="데이터 없음", xref="paper", yref="paper",
                                             x=0.5, y=0.5, showarrow=False,
                                             font=dict(color=self.dark_text))

        df = self.group2_df.copy()

        if selected_region != '전체':
            df = df[df['지역'] == selected_region]

        monthly = df.groupby('연월').agg({
            '119구급차_중증응급환자수': 'sum',
            '119구급차_중증응급환자_전원수': 'sum'
        }).reset_index()
        monthly = monthly.sort_values('연월')

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=monthly['연월'],
            y=monthly['119구급차_중증응급환자수'],
            name='환자수',
            mode='lines+markers',
            line=dict(color=self.accent_green, width=3),
            marker=dict(size=8)
        ))
        fig.add_trace(go.Scatter(
            x=monthly['연월'],
            y=monthly['119구급차_중증응급환자_전원수'],
            name='전원수',
            mode='lines+markers',
            line=dict(color=self.accent_red, width=3),
            marker=dict(size=8)
        ))

        fig.update_layout(
            title=f"{selected_region} - 119 중증응급환자 전원율",
            xaxis_title="월",
            yaxis_title="환자수",
            hovermode='x unified'
        )

        return self.apply_dark_theme(fig)

    def render_group3(self, selected_region):
        """센터급 vs 기관급 분석 렌더링"""
        try:
            if self.group3_df.empty:
                return html.Div([
                    html.H2("센터급 vs 기관급 분석", style={'color': self.dark_text}),
                    html.P("데이터가 없습니다.", style={'color': self.accent_red})
                ], style={'padding': '20px'})

            # 병원분류별 환자수 집계
            if '병원분류' in self.group3_df.columns:
                classification_counts = self.group3_df['병원분류'].value_counts()

                fig = go.Figure(data=[
                    go.Bar(
                        x=classification_counts.index,
                        y=classification_counts.values,
                        marker=dict(
                            color=[self.accent_purple, self.accent_orange],
                            line=dict(color=self.dark_text, width=2)
                        ),
                        text=classification_counts.values,
                        textposition='auto',
                        hovertemplate='<b>%{x}</b><br>환자수: %{y:,.0f}<extra></extra>'
                    )
                ])

                fig.update_layout(
                    title="센터급 vs 기관급 환자 분포",
                    xaxis_title="병원 분류",
                    yaxis_title="환자수"
                )

                fig = self.apply_dark_theme(fig)

                return html.Div([
                    html.H2("센터급 vs 기관급 분석", style={'color': self.dark_text}),
                    dcc.Graph(figure=fig, style={'marginTop': '20px'})
                ], style={'padding': '20px'})
            else:
                return html.Div([
                    html.H2("센터급 vs 기관급 분석", style={'color': self.dark_text}),
                    html.P("병원분류 데이터가 없습니다.", style={'color': self.accent_red})
                ], style={'padding': '20px'})
        except Exception as e:
            return html.Div(f"에러: {str(e)}", style={'color': self.accent_red, 'padding': '20px'})

    def render_monthly_trends(self, selected_region):
        """월별 트렌드 비교 렌더링"""
        try:
            # Group 1 월별 추이
            if not self.group1_df.empty and '연월' in self.group1_df.columns:
                df1 = self.group1_df.copy()
                if selected_region != '전체':
                    df1 = df1[df1['지역'] == selected_region]

                monthly1 = df1.groupby('연월')['전체'].sum().reset_index().sort_values('연월')

                # Group 2 월별 추이
                df2 = self.group2_df.copy()
                if selected_region != '전체':
                    df2 = df2[df2['지역'] == selected_region]

                monthly2 = df2.groupby('연월').agg({
                    '119구급차_중증응급환자수': 'sum'
                }).reset_index().sort_values('연월')

                fig = make_subplots(
                    rows=2, cols=1,
                    subplot_titles=(
                        f"응급진료결과 월별 추이 ({selected_region})",
                        f"119 중증환자 월별 추이 ({selected_region})"
                    ),
                    vertical_spacing=0.15
                )

                # Group 1 차트
                fig.add_trace(
                    go.Scatter(
                        x=monthly1['연월'],
                        y=monthly1['전체'],
                        mode='lines+markers',
                        name='응급진료 환자수',
                        line=dict(color=self.accent_blue, width=3),
                        marker=dict(size=8),
                        hovertemplate='<b>%{x}</b><br>환자수: %{y:,.0f}<extra></extra>'
                    ),
                    row=1, col=1
                )

                # Group 2 차트
                fig.add_trace(
                    go.Scatter(
                        x=monthly2['연월'],
                        y=monthly2['119구급차_중증응급환자수'],
                        mode='lines+markers',
                        name='119 중증환자수',
                        line=dict(color=self.accent_green, width=3),
                        marker=dict(size=8),
                        hovertemplate='<b>%{x}</b><br>환자수: %{y:,.0f}<extra></extra>'
                    ),
                    row=2, col=1
                )

                fig.update_yaxes(title_text="응급진료 환자수", row=1, col=1)
                fig.update_yaxes(title_text="119 중증환자수", row=2, col=1)
                fig.update_xaxes(title_text="연월", row=1, col=1)
                fig.update_xaxes(title_text="연월", row=2, col=1)

                fig.update_layout(height=800, showlegend=True)
                fig = self.apply_dark_theme(fig)

                return html.Div([
                    html.H2(f"월별 트렌드 비교 - {selected_region}", style={'color': self.dark_text}),
                    dcc.Graph(figure=fig, style={'marginTop': '20px'})
                ], style={'padding': '20px'})
            else:
                return html.Div([
                    html.H2("월별 트렌드 비교", style={'color': self.dark_text}),
                    html.P("데이터가 없습니다.", style={'color': self.accent_red})
                ], style={'padding': '20px'})
        except Exception as e:
            return html.Div(f"에러: {str(e)}", style={'color': self.accent_red, 'padding': '20px'})

    def render_regional_analysis(self):
        """지역별 심화 분석 렌더링"""
        try:
            if self.group1_df.empty:
                return html.Div([
                    html.H2("지역별 심화 분석", style={'color': self.dark_text}),
                    html.P("데이터가 없습니다.", style={'color': self.accent_red})
                ], style={'padding': '20px'})

            # 지역별 환자수 집계
            regional_data = self.group1_df.groupby('지역')['전체'].sum().reset_index()
            regional_data = regional_data.sort_values('전체', ascending=False)

            fig = go.Figure(data=[
                go.Bar(
                    x=regional_data['지역'],
                    y=regional_data['전체'],
                    marker=dict(
                        color=self.dark_colors,
                        line=dict(color=self.dark_text, width=1)
                    ),
                    text=regional_data['전체'].apply(lambda x: f'{x:,.0f}'),
                    textposition='auto',
                    hovertemplate='<b>%{x}</b><br>환자수: %{y:,.0f}<extra></extra>'
                )
            ])

            fig.update_layout(
                title="지역별 응급진료 환자수 (누적)",
                xaxis_title="지역",
                yaxis_title="환자수",
                height=600
            )

            fig = self.apply_dark_theme(fig)

            return html.Div([
                html.H2("지역별 심화 분석", style={'color': self.dark_text}),
                dcc.Graph(figure=fig, style={'marginTop': '20px'})
            ], style={'padding': '20px'})
        except Exception as e:
            return html.Div(f"에러: {str(e)}", style={'color': self.accent_red, 'padding': '20px'})

    def render_hospital_transfer(self):
        """병원사정 전원 분석 렌더링"""
        try:
            if self.hospital_transfer_analyzer is None or self.hospital_transfer_charts is None:
                return html.Div([
                    html.H2("병원사정 전원 분석", style={'color': self.dark_text}),
                    html.P("병원사정 분석 데이터를 로드할 수 없습니다.",
                          style={'color': self.accent_red, 'padding': '20px'})
                ], style={'padding': '20px'})

            # 병원사정 전원율 월별 트렌드
            try:
                fig = self.hospital_transfer_charts.create_monthly_trend_chart(institution_type='전체')
                fig = self.apply_dark_theme(fig)

                return html.Div([
                    html.H2("병원사정 전원 분석", style={'color': self.dark_text}),
                    html.Div([
                        html.Label("기관 유형 선택:", style={'color': self.dark_text, 'font-weight': 'bold'}),
                        dcc.Dropdown(
                            id='hospital-institution-filter',
                            options=[
                                {'label': '전체', 'value': '전체'},
                                {'label': '센터급', 'value': '센터급'},
                                {'label': '기관급', 'value': '기관급'}
                            ],
                            value='전체',
                            style={'width': '200px'}
                        )
                    ], style={'margin-bottom': '20px'}),
                    dcc.Graph(figure=fig, style={'marginTop': '20px'})
                ], style={'padding': '20px'})
            except Exception as chart_error:
                print(f"병원사정 차트 생성 에러: {chart_error}")
                return html.Div([
                    html.H2("병원사정 전원 분석", style={'color': self.dark_text}),
                    html.P(f"차트를 생성할 수 없습니다: {str(chart_error)}",
                          style={'color': self.accent_red, 'padding': '20px'})
                ], style={'padding': '20px'})
        except Exception as e:
            return html.Div(f"에러: {str(e)}", style={'color': self.accent_red, 'padding': '20px'})

    def run(self):
        """대시보드 실행"""
        print("[INFO] 다크모드 대시보드 시작 중...")
        self.app.run(debug=False, host='127.0.0.1', port=8060)


if __name__ == '__main__':
    dashboard = DarkModeDashboard()
    dashboard.run()
