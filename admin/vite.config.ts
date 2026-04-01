import { defineConfig } from 'vite';

export default defineConfig({
  base: '/admin/',
  server: {
    port: 5174,
    proxy: {
      // 개발 서버에서 BGM 파일을 클라이언트 dev 서버에서 가져옴
      '/sounds': 'http://localhost:5173',
    },
  },
});
