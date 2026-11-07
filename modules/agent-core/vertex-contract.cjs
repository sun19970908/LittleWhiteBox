'use strict';

// Shared by browser configuration and the drawing backend's strict envelope.
module.exports = Object.freeze({
    defaults: Object.freeze({ authMode: 'relay', projectId: '', location: 'global', serviceAccountJson: '', streamFunctionCallArguments: true }),
    authModes: Object.freeze([
        Object.freeze({ value: 'relay', label: '中转（地址 + API Key）' }),
        Object.freeze({ value: 'service-account', label: '服务账号 JSON（Google Cloud 项目）' }),
        Object.freeze({ value: 'api-key', label: 'API Key（Express）' }),
    ]),
});
