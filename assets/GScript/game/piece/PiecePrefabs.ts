import { PrefabsCfg } from '../../auto/PrefabCfg';

/** 棋子 id -> PrefabsCfg 中的预制体键 */
export const PIECE_PREFAB_KEYS: Readonly<Record<string, keyof typeof PrefabsCfg>> = {
    'PoliceUI-001': 'Police1UI',
    'PoliceUI-002': 'Police2UI',
    'PoliceUI-003': 'Police3UI',
    'PoliceUI-004': 'Police4UI',
    'PoliceUI-005': 'Police5UI',
    'PoliceUI-006': 'Police6UI',
    'Structure-001': 'Structure1UI',
    'Structure-002': 'Structure2UI',
    'Structure-003': 'Structure3UI',
    'Structure-004': 'Structure4UI',
};
