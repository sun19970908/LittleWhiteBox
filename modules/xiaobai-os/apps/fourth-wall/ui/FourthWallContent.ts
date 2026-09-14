import { defineComponent, h, type PropType, type VNodeChild } from 'vue';
import type { FourthWallContent, FourthWallContentNode } from './message-content.js';

export default defineComponent({
    name: 'FourthWallContent',
    props: { content: { type: Object as PropType<FourthWallContent>, required: true } },
    setup(props, { slots }) {
        function render(node: FourthWallContentNode): VNodeChild {
            if (node.kind === 'text') { return node.value; }
            if (node.kind === 'media') {
                const segment = props.content.media[node.index];
                return slots.media?.({ segment, index: node.index }) ?? segment.raw;
            }
            const element = h(node.tag, node.attrs, node.children.map(render));
            return node.tag === 'table' ? h('div', { class: 'fourth-wall-table-scroll' }, [element]) : element;
        }
        return () => h('div', { class: 'fourth-wall-markdown' }, props.content.nodes.map(render));
    },
});
