/**
 * Vite configuration for the TradeDesk Advisor app.
 * Registers the SvelteKit plugin and build tool defaults for the whole project.
 */
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()]
});
