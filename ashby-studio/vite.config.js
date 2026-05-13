import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: must match your repo name exactly.
  // If you rename the repo, change this too.
  // For a user/organization page (repo = <username>.github.io), set this to '/'.
  base: '/Ashby-Studio/',
})
