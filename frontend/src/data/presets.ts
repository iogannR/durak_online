import { Room, UserAccount } from '../types/durak';

export const TABLE_FELT_IMAGE = '/src/assets/images/durak_felt_table_1795438814416.jpg';

export interface AvatarPreset {
  id: string;
  label: string;
  url: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'fox',
    label: 'Лис',
    url: '/src/assets/images/avatar_fox_1795438814268.jpg',
  },
  {
    id: 'owl',
    label: 'Сова',
    url: '/src/assets/images/avatar_owl_1795438814587.jpg',
  },
  {
    id: 'cat',
    label: 'Кот',
    url: '/src/assets/images/avatar_cat_1795438814366.jpg',
  },
  {
    id: 'bear',
    label: 'Медведь',
    url: '/src/assets/images/avatar_bear_1795438814452.jpg',
  },
];

export const INITIAL_ACCOUNTS: UserAccount[] = [
  {
    id: 'acc-matvey',
    username: 'Матвей',
    email: 'matvey@univ.ru',
    passwordHash: '123456',
    avatarUrl: AVATAR_PRESETS[0].url,
    gamesPlayed: 18,
    wins: 11,
    losses: 7,
    createdAt: '2026-10-14',
  },
  {
    id: 'acc-alina',
    username: 'Алина_К',
    email: 'alina@univ.ru',
    passwordHash: '123456',
    avatarUrl: AVATAR_PRESETS[1].url,
    gamesPlayed: 24,
    wins: 15,
    losses: 9,
    createdAt: '2026-10-19',
  },
];

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-1',
    code: '4812',
    title: 'Вечерняя классика · Общага №4',
    mode: 'classic',
    deckSize: 36,
    maxPlayers: 2,
    animMode: 'classic',
    isPrivate: false,
    hostName: 'Алина_К',
    status: 'waiting',
    createdAt: '2 мин назад',
    players: [
      {
        id: 'p-alina',
        username: 'Алина_К',
        avatarUrl: AVATAR_PRESETS[1].url,
        isBot: true,
        isReady: true,
      },
    ],
  },
  {
    id: 'room-2',
    code: '7039',
    title: 'Быстрая партия 36 карт',
    mode: 'classic',
    deckSize: 36,
    maxPlayers: 2,
    animMode: 'fast',
    isPrivate: false,
    hostName: 'Артём_ФМ',
    status: 'waiting',
    createdAt: '5 мин назад',
    players: [
      {
        id: 'p-artem',
        username: 'Артём_ФМ',
        avatarUrl: AVATAR_PRESETS[3].url,
        isBot: true,
        isReady: true,
      },
    ],
  },
  {
    id: 'room-3',
    code: '1924',
    title: 'Большая колода для четверых',
    mode: 'classic',
    deckSize: 52,
    maxPlayers: 4,
    animMode: 'classic',
    isPrivate: false,
    hostName: 'Егор_ВШЭ',
    status: 'waiting',
    createdAt: '9 мин назад',
    players: [
      {
        id: 'p-egor',
        username: 'Егор_ВШЭ',
        avatarUrl: AVATAR_PRESETS[2].url,
        isBot: true,
        isReady: true,
      },
      {
        id: 'p-daria',
        username: 'Даша_М',
        avatarUrl: AVATAR_PRESETS[1].url,
        isBot: true,
        isReady: false,
      },
    ],
  },
  {
    id: 'room-4',
    code: '5510',
    title: 'Тренировочный стол №1',
    mode: 'classic',
    deckSize: 36,
    maxPlayers: 2,
    animMode: 'classic',
    isPrivate: true,
    hostName: 'Кирилл',
    status: 'playing',
    createdAt: '14 мин назад',
    players: [
      {
        id: 'p-kirill',
        username: 'Кирилл',
        avatarUrl: AVATAR_PRESETS[3].url,
        isBot: true,
        isReady: true,
      },
      {
        id: 'p-sofia',
        username: 'София',
        avatarUrl: AVATAR_PRESETS[2].url,
        isBot: true,
        isReady: true,
      },
    ],
  },
];
