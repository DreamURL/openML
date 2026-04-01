import { useLang } from '@/context/LangContext'

const COPY = {
  en: {
    title: 'Browser-based machine learning workflow',
    description:
      'openML helps you upload CSV or Excel data, preprocess columns, train machine learning models, compare metrics, and keep sensitive data on your device.',
    highlights: [
      {
        title: 'Local-first data analysis',
        body: 'Datasets stay in the browser while you clean features, inspect correlations, and prepare data for model training.',
      },
      {
        title: 'Practical model coverage',
        body: 'Run multiple regression, logistic regression, random forest, neural networks, XGBoost, K-Means clustering, and PCA in one flow.',
      },
      {
        title: 'Fast experiment loop',
        body: 'Upload data, tune hyperparameters, compare charts, and export model artifacts without waiting for a separate backend.',
      },
    ],
    workflowTitle: 'Supported workflow',
    workflows: [
      'Upload CSV, XLSX, or XLS datasets directly from your device.',
      'Manage columns, remove outliers, normalize values, and inspect correlation structure.',
      'Train and compare browser-based ML models with shared test splits and visual metrics.',
      'Reuse exported model files to run local predictions on fresh data.',
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        question: 'Does openML send my dataset to a server?',
        answer: 'No. The core data workflow runs locally in the browser, which is useful for privacy-sensitive analysis and quick prototyping.',
      },
      {
        question: 'What file types can I upload?',
        answer: 'The upload step supports CSV and Excel files, so you can start with common spreadsheet exports without extra conversion work.',
      },
      {
        question: 'Who is this tool for?',
        answer: 'It is useful for students, analysts, and developers who want to test machine learning ideas quickly without setting up Python notebooks or cloud infrastructure.',
      },
    ],
  },
  ko: {
    title: '브라우저에서 끝나는 머신러닝 작업 흐름',
    description:
      'openML은 CSV 또는 Excel 데이터를 업로드하고, 컬럼을 전처리하고, 머신러닝 모델을 학습하고, 지표를 비교하는 과정을 브라우저 안에서 처리합니다.',
    highlights: [
      {
        title: '로컬 우선 데이터 분석',
        body: '데이터셋을 외부 서버로 보내지 않고 브라우저 안에서 정리, 상관관계 분석, 학습 준비까지 진행할 수 있습니다.',
      },
      {
        title: '실전형 모델 구성',
        body: '다중회귀, 로지스틱 회귀, 랜덤 포레스트, 신경망, XGBoost, K-Means, PCA를 한 흐름에서 다룰 수 있습니다.',
      },
      {
        title: '빠른 실험 반복',
        body: '업로드, 하이퍼파라미터 조정, 결과 비교, 모델 저장까지 별도 백엔드 없이 빠르게 반복할 수 있습니다.',
      },
    ],
    workflowTitle: '지원하는 작업 흐름',
    workflows: [
      '기기에서 바로 CSV, XLSX, XLS 데이터를 업로드합니다.',
      '컬럼 정리, 이상치 제거, 정규화, 상관관계 확인으로 학습용 데이터를 준비합니다.',
      '여러 브라우저 기반 ML 모델을 같은 테스트 비율로 학습하고 비교합니다.',
      '저장한 모델 파일을 다시 불러와 새로운 데이터에 로컬 예측을 수행합니다.',
    ],
    faqTitle: '자주 묻는 내용',
    faqs: [
      {
        question: '데이터가 서버로 전송되나요?',
        answer: '아니요. 핵심 데이터 처리 흐름은 브라우저에서 로컬로 실행되므로 민감한 데이터 실험이나 빠른 프로토타이핑에 유리합니다.',
      },
      {
        question: '어떤 파일을 업로드할 수 있나요?',
        answer: 'CSV와 Excel 파일을 지원하므로 일반적인 스프레드시트 내보내기 결과를 바로 사용할 수 있습니다.',
      },
      {
        question: '누가 쓰기 좋은 도구인가요?',
        answer: '학생, 데이터 분석가, 개발자가 Python 노트북이나 클라우드 환경을 먼저 만들지 않고도 빠르게 ML 아이디어를 시험해 볼 때 적합합니다.',
      },
    ],
  },
} as const

export function HomeSeoContent() {
  const { lang } = useLang()
  const content = lang === 'ko' ? COPY.ko : COPY.en

  return (
    <section className="bg-surface border border-border rounded-xl p-6 space-y-6" aria-labelledby="home-seo-title">
      <div className="max-w-3xl">
        <h2 id="home-seo-title" className="text-xl font-semibold">
          {content.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">{content.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {content.highlights.map((item) => (
          <section key={item.title} className="bg-bg border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">{item.body}</p>
          </section>
        ))}
      </div>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">{content.workflowTitle}</h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {content.workflows.map((item) => (
            <li key={item} className="bg-bg border border-border rounded-xl px-4 py-3 text-sm leading-6 text-text-muted">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">{content.faqTitle}</h3>
        <div className="mt-3 space-y-3">
          {content.faqs.map((item) => (
            <article key={item.question} className="bg-bg border border-border rounded-xl p-4">
              <h4 className="text-sm font-semibold">{item.question}</h4>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
