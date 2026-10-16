import * as THREE from 'three';
import {W, H} from '../config/timeline';
import type {V3} from './core';

// Проекция 3D-точки в пиксели кадра — для HUD-подписей, привязанных к деталям.
const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 1000);
export const project = (p: V3, pos: V3, target: V3, fov: number, roll = 0): [number, number, boolean] => {
  cam.fov = fov;
  cam.aspect = W / H;
  cam.position.set(...pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(...target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H, v.z < 1];
};
