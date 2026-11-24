/**
 * Punto de entrada del módulo. Al importarse:
 *   1. convierte el componente Vue en un Custom Element (defineCustomElement)
 *   2. lo registra como <todo-editor>, una sola vez
 *   3. exporta la versión, que el shell muestra en el pie
 */
import { defineCustomElement } from 'vue';
import TodoEditor from './TodoEditor.ce.vue';

export const version = __VERSION__;

const TodoEditorElement = defineCustomElement(TodoEditor);

if (!customElements.get('todo-editor')) {
  customElements.define('todo-editor', TodoEditorElement);
}
