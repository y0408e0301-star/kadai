// ビルド時に渡す環境変数（import.meta.env）の型
interface ImportMetaEnv {
  // デモ環境（公開環境）のビルドで deploy.sh が 1 にする。あると「毎日サンプルに戻る」と表示する
  readonly VITE_DEMO_NOTICE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
