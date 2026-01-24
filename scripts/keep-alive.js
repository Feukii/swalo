#!/usr/bin/env node

/**
 * Keep-Alive Script for Render Free Tier
 *
 * Ce script ping l'API SWALO toutes les 10 minutes pour éviter
 * que Render ne mette le service en veille (spin down) sur le plan gratuit.
 *
 * Usage:
 * 1. Configurer sur cron-job.org (gratuit)
 * 2. URL à pinger: https://swalo-api.onrender.com/api/health
 * 3. Intervalle: toutes les 10 minutes
 *
 * Alternative: Déployer ce script sur un autre service gratuit
 */

const API_URL = process.env.API_URL || 'https://swalo-api.onrender.com/api/health';
const INTERVAL = 10 * 60 * 1000; // 10 minutes

async function ping() {
  try {
    const response = await fetch(API_URL);
    const timestamp = new Date().toISOString();

    if (response.ok) {
      console.log(` [${timestamp}] API is alive - Status: ${response.status}`);
    } else {
      console.warn(`   [${timestamp}] API responded with status: ${response.status}`);
    }
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`L [${timestamp}] Failed to ping API:`, error.message);
  }
}

// Ping immédiatement au démarrage
ping();

// Puis ping toutes les 10 minutes
setInterval(ping, INTERVAL);

console.log(`=€ Keep-alive script started. Pinging ${API_URL} every ${INTERVAL / 1000 / 60} minutes.`);
