import { withExtensionJsApiManifest } from '../../variables/state3/skill/public-api';
import { withIframeRendererJsApiManifest } from '../../iframe-renderer/assistant-api';

// Host execution and the assistant's approval analysis use the same extensions.
export function withAssistantJsApiManifest(manifest = {}) {
    return withIframeRendererJsApiManifest(withExtensionJsApiManifest(manifest));
}
