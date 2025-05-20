# リアルタイムカードゲーム

Socket.IOとReactを使用した2人用リアルタイムカードゲームです。プレイヤーは部屋を作成し、他のプレイヤーが参加できます。各プレイヤーは手札を持ち、交互にカードをプレイします。

## 機能

- リアルタイム通信によるマルチプレイヤーゲーム
- 部屋の作成と参加機能
- カードのプレイとドロー機能
- ゲーム進行状況のリアルタイム同期
- プレイヤーの切断・再接続処理

## インストールと実行方法

### 必要条件

- Node.js (12.x以上)
- npm (6.x以上)

### インストール

1. レポジトリをクローンまたはダウンロードする
2. プロジェクトディレクトリに移動する
3. 依存パッケージをインストールする:

```bash
npm install
```

### 実行方法

開発モードでアプリケーションを実行するには：

```bash
npm run dev
```

これにより、以下が起動します：
- フロントエンドサーバー: http://localhost:3000
- バックエンドサーバー: http://localhost:3001

## ゲームの遊び方

1. 最初のプレイヤーが部屋を作成し、部屋IDを取得します
2. 二人目のプレイヤーは、その部屋IDを使用して部屋に参加します
3. 両方のプレイヤーが参加すると、ゲームが開始できます
4. プレイヤーは交互にカードをプレイします
5. 最初に手札を使い切ったプレイヤーが勝者です

## 技術スタック

- **フロントエンド**: React, CSS
- **バックエンド**: Node.js, Express
- **リアルタイム通信**: Socket.IO

## ライセンス

MITライセンス

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
