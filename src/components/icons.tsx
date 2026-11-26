import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });

export const IconHome = (p: P) => (<svg {...base(p)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h5v-6h4v6h5V10" /></svg>);
export const IconSearch = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconFilm = (p: P) => (<svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></svg>);
export const IconTv = (p: P) => (<svg {...base(p)}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m8 2 4 4 4-4" /></svg>);
export const IconLive = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="2.5" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></svg>);
export const IconStar = (p: P) => (<svg {...base(p)}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /></svg>);
export const IconPlay = (p: P) => (<svg {...base(p)} fill="currentColor" stroke="none"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>);
export const IconPause = (p: P) => (<svg {...base(p)} fill="currentColor" stroke="none"><rect x="6" y="4" width="4.5" height="16" rx="1" /><rect x="13.5" y="4" width="4.5" height="16" rx="1" /></svg>);
export const IconBack = (p: P) => (<svg {...base(p)}><path d="M15 5 8 12l7 7" /></svg>);
export const IconChevronLeft = (p: P) => (<svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>);
export const IconChevronRight = (p: P) => (<svg {...base(p)}><path d="m9 18 6-6-6-6" /></svg>);
export const IconRewind = (p: P) => (<svg {...base(p)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><text x="12" y="15.5" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text></svg>);
export const IconForward = (p: P) => (<svg {...base(p)}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /><text x="12" y="15.5" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text></svg>);
export const IconVolume = (p: P) => (<svg {...base(p)}><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>);
export const IconMute = (p: P) => (<svg {...base(p)}><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="m17 9 5 6M22 9l-5 6" /></svg>);
export const IconFullscreen = (p: P) => (<svg {...base(p)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
export const IconExitFullscreen = (p: P) => (<svg {...base(p)}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>);
export const IconNext = (p: P) => (<svg {...base(p)}><path d="m5 5 10 7-10 7z" fill="currentColor" /><path d="M19 5v14" /></svg>);
export const IconLogout = (p: P) => (<svg {...base(p)}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" /></svg>);
export const IconUp = (p: P) => (<svg {...base(p)}><path d="m6 15 6-6 6 6" /></svg>);
export const IconDown = (p: P) => (<svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>);
