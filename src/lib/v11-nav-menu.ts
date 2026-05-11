/**
 * 사이드바·모바일 드로어 공용 메뉴 데이터
 *
 * V2.1 — v1.0 + v1.1 통합 그룹화 (8 섹션)
 * 기존 자료 절대 보존: v10MenuItems / v11MenuItems 두 export 도 그대로 유지.
 * Sidebar / MobileNav 는 새 menuGroups 를 사용.
 */
import {
  LayoutDashboard,
  Receipt,
  Users,
  AlertCircle,
  Package,
  Wallet,
  BarChart3,
  Bot,
  Settings,
  CalendarCheck,
  FileText,
  PieChart,
  Upload as UploadIcon,
  Layers,
  Target as TargetIcon,
  Coins,
  Layers3,
  Workflow,
  Sun,
  CalendarDays,
  Brain,
  MessageSquare,
  Briefcase,
  Megaphone,
  Package as PackageIcon,
  Bell,
  Compass,
  Send,
  Wand2,
  PackageOpen,
  Sparkles,
  Home as HomeIcon,
  TrendingUp,
  ShoppingBag,
  Cpu,
  Lightbulb,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type MenuItem = { href: string; label: string; icon: LucideIcon }

export type MenuGroup = {
  id: string
  label: string
  icon: LucideIcon
  items: MenuItem[]
}

// ============================================================
// 레거시 (v1.0 / v1.1 분리) — 다른 코드가 import 할 수 있어 보존
// ============================================================

export const v10MenuItems: MenuItem[] = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/settlement', label: '일일 결산', icon: CalendarCheck },
  { href: '/transactions', label: '거래 관리', icon: Receipt },
  { href: '/clients', label: '거래처 관리', icon: Users },
  { href: '/receivables', label: '미수금 관리', icon: AlertCircle },
  { href: '/products', label: '제품 관리', icon: Package },
  { href: '/costs', label: '비용 관리', icon: Wallet },
  { href: '/analysis', label: '분석/시뮬레이션', icon: BarChart3 },
  { href: '/advisor', label: 'AI CFO 자문', icon: Bot },
  { href: '/documents', label: '공문 작성', icon: FileText },
  { href: '/settings', label: '설정', icon: Settings },
]

export const v11MenuItems: MenuItem[] = [
  { href: '/finance/daily', label: '일일 운영', icon: Sun },
  { href: '/finance/briefing', label: '모닝 브리핑 (AI)', icon: Brain },
  { href: '/finance/consult', label: '라이브 컨설팅 (AI)', icon: MessageSquare },
  { href: '/finance', label: '재무 메인 (v1.1)', icon: PieChart },
  { href: '/finance/decomposition', label: '매출 인수분해', icon: Layers },
  { href: '/finance/expenses', label: '자원 인수분해', icon: Coins },
  { href: '/finance/sales', label: '영업 (#2a)', icon: Briefcase },
  { href: '/finance/sales/materials', label: '영업자료 자동생성 (#9)', icon: Wand2 },
  { href: '/finance/marketing', label: '마케팅 (#2b)', icon: Megaphone },
  { href: '/finance/ai-create', label: 'AI Create', icon: Sparkles },
  { href: '/finance/operations', label: '운영·샘플 (#2c)', icon: PackageIcon },
  { href: '/finance/operations/intake', label: '입고 워크플로우 (#10)', icon: PackageOpen },
  { href: '/finance/alerts', label: '이상치 알림 (#3)', icon: Bell },
  { href: '/finance/cockpit', label: 'CEO 코크핏 (#7)', icon: Compass },
  { href: '/finance/team', label: '팀 공유·슬랙 (#8)', icon: Send },
  { href: '/finance/positioning', label: '포지셔닝 매트릭스', icon: Layers3 },
  { href: '/finance/pricing', label: '4단계 가격 결정', icon: Workflow },
  { href: '/finance/cycle', label: '12주 대시보드', icon: TargetIcon },
  { href: '/finance/wam', label: 'WAM (주간 회의)', icon: CalendarDays },
  { href: '/finance/upload', label: '일계표 업로드', icon: UploadIcon },
  { href: '/finance/clients', label: '거래처 관리 (v1.1)', icon: Users },
]

// ============================================================
// V2.1 통합 그룹 — Sidebar / MobileNav 가 사용
// 비슷한 카테고리는 같은 섹션에. 삭제·이름 변경 X — 그룹화만.
// ============================================================

export const menuGroups: MenuGroup[] = [
  {
    id: 'home',
    label: 'DIAVIS',
    icon: HomeIcon,
    items: [
      { href: '/', label: 'DIAVIS 홈', icon: Sparkles },
      { href: '/dashboard', label: '경영 대시보드', icon: LayoutDashboard },
    ],
  },
  {
    id: 'daily',
    label: 'Daily',
    icon: Sun,
    items: [
      { href: '/finance/daily', label: '일일 운영', icon: Sun },
      { href: '/settlement', label: '일일 결산', icon: CalendarCheck },
      { href: '/finance/briefing', label: '모닝 브리핑 (AI)', icon: Brain },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: PieChart,
    items: [
      { href: '/finance', label: '재무 메인', icon: PieChart },
      { href: '/transactions', label: '거래 관리', icon: Receipt },
      { href: '/finance/decomposition', label: '매출 인수분해', icon: Layers },
      { href: '/finance/expenses', label: '자원 인수분해', icon: Coins },
      { href: '/receivables', label: '미수금 관리', icon: AlertCircle },
      { href: '/costs', label: '비용 관리', icon: Wallet },
      { href: '/analysis', label: '분석/시뮬레이션', icon: BarChart3 },
      { href: '/finance/upload', label: '일계표 업로드', icon: UploadIcon },
    ],
  },
  {
    id: 'go-to-market',
    label: 'Go-To-Market',
    icon: Briefcase,
    items: [
      { href: '/clients', label: '거래처 관리', icon: Users },
      { href: '/finance/clients', label: '거래처 (v1.1)', icon: Users },
      { href: '/finance/sales', label: '영업', icon: Briefcase },
      { href: '/finance/sales/materials', label: '영업자료 자동생성', icon: Wand2 },
      { href: '/finance/marketing', label: '마케팅', icon: Megaphone },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: ShoppingBag,
    items: [
      { href: '/products', label: '제품 관리', icon: Package },
      { href: '/finance/operations', label: '운영·샘플', icon: PackageIcon },
      { href: '/finance/operations/intake', label: '입고 워크플로우', icon: PackageOpen },
    ],
  },
  {
    id: 'strategy',
    label: 'Strategy',
    icon: Compass,
    items: [
      { href: '/finance/positioning', label: '포지셔닝 매트릭스', icon: Layers3 },
      { href: '/finance/pricing', label: '4단계 가격 결정', icon: Workflow },
      { href: '/finance/cycle', label: '12주 대시보드', icon: TargetIcon },
      { href: '/finance/wam', label: 'WAM (주간 회의)', icon: CalendarDays },
      { href: '/finance/cockpit', label: 'CEO 코크핏', icon: Compass },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    icon: Cpu,
    items: [
      { href: '/advisor', label: 'AI CFO 자문', icon: Bot },
      { href: '/finance/consult', label: '라이브 컨설팅 (AI)', icon: MessageSquare },
      { href: '/finance/ai-create', label: 'AI Create', icon: Sparkles },
      { href: '/documents', label: '공문 작성 (AI)', icon: FileText },
    ],
  },
  {
    id: 'collab',
    label: 'Team & Tools',
    icon: Wrench,
    items: [
      { href: '/finance/team', label: '팀 공유·슬랙', icon: Send },
      { href: '/finance/alerts', label: '이상치 알림', icon: Bell },
      { href: '/settings', label: '설정', icon: Settings },
    ],
  },
]

// ============================================================
// Helpers
// ============================================================

/** 활성 상태 판정 헬퍼 */
export function isMenuActive(itemHref: string, pathname: string): boolean {
  if (itemHref === '/') return pathname === '/'
  if (itemHref === '/finance') return pathname === '/finance'
  if (itemHref === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(itemHref)
}

/** 그룹 확장 상태 초기값 — 현재 활성 그룹은 자동 펼침 */
export function getInitialExpandedGroups(pathname: string): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const g of menuGroups) {
    result[g.id] = g.items.some((i) => isMenuActive(i.href, pathname))
  }
  // 홈 그룹은 항상 기본 펼침
  result['home'] = true
  return result
}
