/* Firebase web config for the hybrid AI features.
 * These values are public identifiers, not secrets. App Check (reCAPTCHA Enterprise)
 * blocks calls that do not come from this site. On localhost a debug token is used.
 * Leave firebase as null to turn the Gemini features off; the rest of the page works the same. */
window.ALD_FIREBASE = {
  firebase: {
    apiKey: "AIzaSyBeyoxRUx0dSIux-vooi0PaDhCskrwrIx0",
    authDomain: "aid-letter-decoder.firebaseapp.com",
    projectId: "aid-letter-decoder",
    storageBucket: "aid-letter-decoder.firebasestorage.app",
    messagingSenderId: "854241013839",
    appId: "1:854241013839:web:d33079d2796748638fba3a"
  },
  recaptchaSiteKey: "6Le5hB8uAAAAAFnefLYeGnjVpaeoDC7bX2kU0AsP"
};
