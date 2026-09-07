<script setup lang="ts">
import { computed } from 'vue';
import type { MapDomainV1, MapLocation } from '../../../domains/map/types.js';
import MapIcon from './MapIcon.vue';
import { connectedPlaces, locationTrail } from './world-map.js';
import { MAP_SCALE_LABELS, MAP_LINK_LABELS } from './map-presentation.js';
const props = defineProps<{ location: MapLocation; map: MapDomainV1; currentKey: string }>();
defineEmits<{ close: []; scene: []; explore: []; select: [key: string] }>();
const trail = computed(() => locationTrail(props.map.atlas, props.location.key).slice(0, -1));
const children = computed(() => props.map.atlas.locations.filter(place => place.parent === props.location.key));
const actors = computed(() => props.map.atlas.actors.filter(actor => actor.locationKey === props.location.key));
const connections = computed(() => connectedPlaces(props.map.atlas, props.location.key));
const scene = computed(() => props.location.sceneKey ? props.map.scenes[props.location.sceneKey] : undefined);
</script>
<template>
    <section class="map-place-detail" aria-labelledby="map-place-title">
        <div class="map-sheet-grip" aria-hidden="true" />
        <header><div><small>{{ MAP_SCALE_LABELS[location.scale] }} · {{ currentKey === location.key ? '当前位置' : location.status === 'visited' ? '已到访' : '未到访' }}</small><h2 id="map-place-title">{{ location.name }}</h2></div><button type="button" class="map-round-button" aria-label="关闭地点详情" @click="$emit('close')"><MapIcon name="close" /></button></header>
        <div class="map-place-content">
            <p v-if="location.name.length > 24" class="map-place-full-name">{{ location.name }}</p>
            <p v-if="trail.length" class="map-address"><MapIcon name="pin" />{{ trail.map(place => place.name).join(' · ') }}</p>
            <p class="map-place-intro">{{ location.brief || '这个地点已记录在世界地图上，更多介绍等待故事展开。' }}</p>
            <div v-if="children.length || scene" class="map-place-actions"><button v-if="children.length" type="button" class="map-primary-button" @click="$emit('explore')"><MapIcon name="compass" />探索这里 · {{ children.length }} 处</button><button v-if="scene" type="button" class="map-secondary-button" @click="$emit('scene')"><MapIcon name="layers" />查看场景图</button></div>
            <section v-if="actors.length" class="map-detail-section"><h3>记录在这里的人物</h3><p class="map-people"><span v-for="actor in actors" :key="actor.actorKey"><MapIcon name="person" />{{ actor.displayName }}</span></p></section>
            <section v-if="connections.length" class="map-detail-section"><h3>相连的地方</h3><button v-for="connection in connections" :key="connection.link.id" type="button" class="map-connection" @click="$emit('select', connection.location.key)"><MapIcon name="route" /><span><strong>{{ connection.location.name }}</strong><small>{{ connection.link.label || MAP_LINK_LABELS[connection.link.kind] }}{{ connection.link.bidirectional ? '' : connection.outgoing ? ' · 单向前往' : ' · 仅可从对面到达' }}</small></span><MapIcon name="next" /></button></section>
            <p class="map-detail-footnote">查看地图不会改变你在故事中的位置</p>
        </div>
    </section>
</template>
