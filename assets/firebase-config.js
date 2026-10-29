// Firebase web app config (Firebase console → Project settings → Your apps).
// The same code runs on the live site and the test site (staging.jobsearchph.com).
// The test site uses its own Firebase project so tests never touch real users or jobs.
export const IS_STAGING = /^staging\./.test(location.hostname) || /\.github\.io$/.test(location.hostname);

// Test site project (job-search-ph-staging). The test site never falls back to the real database.
const STAGING_CONFIG = {
  apiKey: "AIzaSyCPr4CGcdQq_SYNw5UajHjA66I53d50paI",
  authDomain: "job-search-ph-staging.firebaseapp.com",
  projectId: "job-search-ph-staging",
  storageBucket: "job-search-ph-staging.firebasestorage.app",
  messagingSenderId: "205868583791",
  appId: "1:205868583791:web:f6ea6115385ae98ac7b69a",
};

const LIVE_CONFIG = {
  apiKey: "AIzaSyAc8z7FwRCxDbXj1g2WFdf7A_5iitPJytg",
  authDomain: "jobsearchph.com", // sign-in helper self-hosted in /__/auth (was job-search-ph-website.firebaseapp.com)
  projectId: "job-search-ph-website",
  storageBucket: "job-search-ph-website.firebasestorage.app",
  messagingSenderId: "541010223461",
  appId: "1:541010223461:web:137fa8725eef2465f8018c",
};

export const firebaseConfig = IS_STAGING ? STAGING_CONFIG : LIVE_CONFIG;

// Helper (Cloudflare Worker in helper/): texts phone codes and sends the branded account emails.
// Empty = phone confirmation is hidden, and account emails fall back to Firebase's own plain emails.
export const HELPER_URL = "";
// Text-message (SMS) codes through the helper. Off until UniSMS is set up (the emails work without it).
export const SMS_ON = false;

// How long an approved post stays live.
export const LISTING_DAYS = 30;

// Resume file uploads need Firebase Storage, which requires the Blaze plan.
// Turn this on after creating the Storage bucket and publishing storage.rules.
export const RESUME_UPLOADS = false;
// "Continue with Facebook". Turn on only after the Facebook app is set up and the Facebook
// provider is enabled in this site's Firebase project (Authentication → Sign-in method).
export const FB_LOGIN = { staging: false, live: false }[IS_STAGING ? "staging" : "live"];
