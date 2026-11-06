import { readFileSync } from 'node:fs'
import { FIXTURE } from './files'

/** Metrics the fake renderer reports for any model, with values no fixture row uses so they can be traced. */
export const PREVIEW_METRICS = { triangles: 1234, materials: 2, textures: 2, meshes: 1, bodies: 1, entities: 1 }

let html: string | undefined

/**
 * Stands in for the wearable-preview app, which can't render headless. It speaks the same postMessage protocol
 * (`@dcl/schemas` PreviewMessageType): READY on boot, LOAD after boot and after every UPDATE, and an answer to
 * every controller request, with the fixture thumbnail as the screenshot.
 */
export function previewPageHtml(): string {
  html ??= `<!doctype html><title>preview</title><script>
    var SCREENSHOT = 'data:image/png;base64,${readFileSync(FIXTURE.thumbnail).toString('base64')}';
    var METRICS = ${JSON.stringify(PREVIEW_METRICS)};
    var RESULTS = {
      'scene.getScreenshot': SCREENSHOT,
      'scene.getMetrics': METRICS,
      'emote.getLength': 2,
      'emote.isPlaying': false,
      'emote.hasSound': false
    };
    function send(type, payload) { parent.postMessage({ type: type, payload: payload }, '*'); }
    function loaded() { send('load', { renderer: 'babylon' }); }
    window.addEventListener('message', function (event) {
      var message = event.data || {};
      if (message.type === 'update') loaded();
      if (message.type === 'controller_request') {
        var request = message.payload || {};
        var key = request.namespace + '.' + request.method;
        send('controller_response', { id: request.id, ok: true, result: RESULTS[key] });
      }
    });
    // The parent may attach its listener after this frame boots, so READY is repeated for a moment.
    var sent = 0;
    var boot = setInterval(function () {
      send('ready');
      if (sent === 0) loaded();
      if (++sent > 10) clearInterval(boot);
    }, 100);
  </script>`
  return html
}
