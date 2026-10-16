import * as THREE from 'three';
import {brushedTexture, dustTexture, ihsTexture, memo, pcbTextures, radialBrushedTexture} from './textures';

const std = (key: string, p: THREE.MeshStandardMaterialParameters) => memo('mat:' + key, () => new THREE.MeshStandardMaterial(p));
const phys = (key: string, p: THREE.MeshPhysicalMaterialParameters) => memo('mat:' + key, () => new THREE.MeshPhysicalMaterial(p));

export const M = {
  pcb: () => {
    const t = pcbTextures();
    return std('pcb', {map: t.map, roughnessMap: t.roughnessMap, roughness: 0.75, metalness: 0.15});
  },
  pcbPlain: () => std('pcbPlain', {color: '#0d1219', roughness: 0.6, metalness: 0.15}),
  plastic: () => std('plastic', {color: '#16191e', roughness: 0.55, metalness: 0.05}),
  plasticGray: () => std('plasticGray', {color: '#2a2f37', roughness: 0.5, metalness: 0.05}),
  rubber: () => std('rubber', {color: '#0b0d10', roughness: 0.9}),
  darkAlu: () => phys('darkAlu', {color: '#3a414b', metalness: 1, roughness: 0.42, roughnessMap: brushedTexture(), clearcoat: 0.3, clearcoatRoughness: 0.35}),
  gunmetal: () => phys('gunmetal', {color: '#20252c', metalness: 0.9, roughness: 0.38, roughnessMap: brushedTexture(), clearcoat: 0.6, clearcoatRoughness: 0.2}),
  alu: () => std('alu', {color: '#b3b9c1', metalness: 1, roughness: 0.52, roughnessMap: brushedTexture()}),
  nickel: () => phys('nickel', {color: '#dfe3e8', metalness: 1, roughness: 0.24, clearcoat: 0.2}),
  copper: () => std('copper', {color: '#d0835a', metalness: 1, roughness: 0.24}),
  gold: () => std('gold', {color: '#e0b25a', metalness: 1, roughness: 0.22}),
  steel: () => std('steel', {color: '#bfc5cd', metalness: 1, roughness: 0.22, roughnessMap: brushedTexture()}),
  // матовая шлифованная крышка кулера: не даёт зеркального блика сверху
  coolerCap: () => std('coolerCap', {color: '#2c323b', metalness: 0.8, roughness: 0.58, roughnessMap: brushedTexture()}),
  steelSatin: () => std('steelSatin', {color: '#8f97a1', metalness: 0.9, roughness: 0.48, roughnessMap: brushedTexture()}),
  chrome: () => std('chrome', {color: '#b9bec6', metalness: 1, roughness: 0.12}),
  capAlu: () => std('capAlu', {color: '#a5adb7', metalness: 0.95, roughness: 0.32}),
  choke: () => std('choke', {color: '#2c2f34', metalness: 0.35, roughness: 0.55}),
  chipBody: () => std('chipBody', {color: '#14171b', metalness: 0.2, roughness: 0.45}),
  castAlu: () => std('castAlu', {color: '#9ea5ae', metalness: 0.85, roughness: 0.55}),
  buttonMetal: () => phys('buttonMetal', {color: '#b9c0c9', metalness: 1, roughness: 0.28, roughnessMap: radialBrushedTexture(), clearcoat: 0.5}),
  glass: () =>
    phys('glass', {
      color: '#0b1724',
      metalness: 0,
      roughness: 0.04,
      transparent: true,
      opacity: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
      depthWrite: false,
    }),
  ihs: () => phys('ihs', {map: ihsTexture(), metalness: 0.6, roughness: 0.42, roughnessMap: brushedTexture()}),
  // Старая высохшая термопаста и свежая
  oldPaste: () => std('oldPaste', {color: '#7d7b77', roughness: 0.9, metalness: 0.1}),
  newPaste: () => phys('newPaste', {color: '#b7bcc2', roughness: 0.38, metalness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3}),
  dust: () =>
    std('dust', {
      color: '#b3aa9f',
      roughness: 1,
      metalness: 0,
      alphaMap: dustTexture(),
      transparent: true,
      depthWrite: false,
    }),
};

// Светящийся материал (подсветка, LED). Яркость >1 подхватывается bloom.
export const glow = (color: string, k = 1.4) =>
  memo(`glow:${color}:${k}`, () => new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(Math.min(k, 3) * 0.6), toneMapped: false}));
