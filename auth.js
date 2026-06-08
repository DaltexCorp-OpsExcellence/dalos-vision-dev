/*
 * DalOS shared auth (auth.js)
 * ---------------------------------------------------------------------------
 * One login across Vision and Analytics. Both apps live on the same origin
 * (https://daltexcorp-opsexcellence.github.io), so the Supabase session in
 * localStorage is already shared between them. This module is the single
 * place that reads/writes that session.
 *
 * Usage in any app (after including supabase-js v2):
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="/auth.js"></script>
 *   <script>DalOSAuth.requireAuth();</script>   // gate a protected page
 *
 * NOTE: no custom storageKey is set on purpose, so this uses Supabase's
 * default key (sb-<ref>-auth-token) — the same key Vision already uses.
 * That is what makes the session shared. If Vision uses a custom storageKey,
 * set the same value in the createClient options below.
 */
(function (global) {
  "use strict";

  var SUPABASE_URL = "https://sfyjvgjwvtwkrnqrvqyc.supabase.co";
  var SUPABASE_KEY = "sb_publishable_kTybwJUuzRATg61-3KmYeQ_ixf30TXi";

  // Where the single login page is deployed (root-absolute, same origin).
  // Works from any sub-path app because all apps share this origin.
  var LOGIN_PATH = "/login.html";

  if (!global.supabase || !global.supabase.createClient) {
    throw new Error("[DalOSAuth] supabase-js must be loaded before auth.js");
  }

  var client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
      // storageKey: "..."  // only if Vision overrides the default
    }
  });

  // Only allow same-origin relative redirect targets (no open-redirect).
  function safeNext(next, fallback) {
    try {
      var u = new URL(next, global.location.origin);
      if (u.origin !== global.location.origin) return fallback;
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return fallback;
    }
  }

  var DalOSAuth = {
    client: client,

    getSession: function () {
      return client.auth.getSession().then(function (res) {
        return (res.data && res.data.session) || null;
      });
    },

    getUser: function () {
      return this.getSession().then(function (s) {
        return s ? s.user : null;
      });
    },

    signIn: function (email, password) {
      return client.auth.signInWithPassword({ email: email, password: password });
    },

    signOut: function () {
      return client.auth.signOut();
    },

    // Gate a protected page. If not signed in, bounce to the login page and
    // remember where the user was trying to go.
    requireAuth: function () {
      return this.getSession().then(function (session) {
        if (!session) {
          var here = global.location.pathname + global.location.search;
          global.location.replace(LOGIN_PATH + "?next=" + encodeURIComponent(here));
          return null;
        }
        return session;
      });
    },

    // Called by login.html after a successful sign-in.
    redirectAfterLogin: function (defaultPath) {
      var params = new URLSearchParams(global.location.search);
      var raw = params.get("next");
      var dest = raw ? safeNext(decodeURIComponent(raw), defaultPath || "/") : (defaultPath || "/");
      global.location.replace(dest);
    },

    onChange: function (cb) {
      return client.auth.onAuthStateChange(function (_event, session) {
        cb(session);
      });
    }
  };

  global.DalOSAuth = DalOSAuth;
})(window);
