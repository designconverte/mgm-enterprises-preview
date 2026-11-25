/* Public module configuration (no secrets).
   Tracking: off until the partner sends the tags (GTM/GA4/Meta); with mode 'off' nothing external loads.
   serviceArea.zips: Barnstable County + the 11 South Shore towns (GeoNames postal codes); other ZIPs still send,
   with the form's "outside the towns we usually cover" note. */
window.CS_CONFIG = {
  siteId: 'mgm-enterprises',
  lead: {
    endpoint: '/api/lead.php',
    redirect: '/thank-you/',
    smsConsentVersion: 'sms-estimate-en-v1-2026-11-25'
  },
  serviceArea: {
    zips: [
      '02018', '02020', '02025', '02040', '02041', '02043', '02044', '02045', '02047', '02050', '02051', '02055',
      '02059', '02060', '02061', '02065', '02066', '02327', '02331', '02332', '02339', '02340', '02345', '02358',
      '02359', '02360', '02361', '02362', '02364', '02381', '02532', '02534', '02536', '02537', '02540', '02541',
      '02542', '02543', '02553', '02556', '02559', '02561', '02562', '02563', '02574', '02601', '02630', '02631',
      '02632', '02633', '02634', '02635', '02637', '02638', '02639', '02641', '02642', '02643', '02644', '02645',
      '02646', '02647', '02648', '02649', '02650', '02651', '02652', '02653', '02655', '02657', '02659', '02660',
      '02661', '02662', '02663', '02664', '02666', '02667', '02668', '02669', '02670', '02671', '02672', '02673',
      '02675'
    ],
    outOfArea: 'accept-with-message'
  },
  tracking: {
    mode: 'off',
    ga4: null,
    metaPixel: null,
    googleAds: null,
    gtm: null,
    consentDefault: 'granted',
    leadValue: null,
    debugParam: 'cs_debug'
  }
};

// preview copy: the form is simulated and nothing is tracked
window.CS_CONFIG = Object.assign({}, window.CS_CONFIG, { preview: true });
window.CS_CONFIG.lead = Object.assign({}, window.CS_CONFIG.lead, { endpoint: '/mgm-enterprises-preview/api/lead.php', redirect: null });
window.CS_CONFIG.tracking = Object.assign({}, window.CS_CONFIG.tracking, { mode: 'off', ga4: null, metaPixel: null, googleAds: null, gtm: null });
