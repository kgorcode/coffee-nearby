import { defineConfig } from 'vite'

// GitHub Pages project site: https://kgorcode.github.io/coffee-nearby/
export default defineConfig({
  base: process.env.VITE_BASE || '/coffee-nearby/',
})
