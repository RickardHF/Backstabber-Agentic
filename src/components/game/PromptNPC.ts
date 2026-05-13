import { Player } from './types';
import { getUserSpawnPoint } from './MapLayout';

export interface PromptNPC {
  id: 'toasty-llama';
  x: number;
  y: number;
  size: number;
  interactRadius: number;
  isWorking: boolean;
}

export const createPromptNPC = (): PromptNPC => {
  const spawn = getUserSpawnPoint();
  return {
    id: 'toasty-llama',
    x: spawn.x + 110,
    y: spawn.y,
    size: 22,
    interactRadius: 110,
    isWorking: false,
  };
};

export const isPlayerInRange = (player: Player, npc: PromptNPC): boolean => {
  const dx = player.x - npc.x;
  const dy = player.y - npc.y;
  return Math.sqrt(dx * dx + dy * dy) <= npc.interactRadius + player.size;
};
