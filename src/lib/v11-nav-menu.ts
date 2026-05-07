/**
 * 사이드바·모바일 드로어 공용 메뉴 데이터
 * Sidebar.tsx 와 MobileNav.tsx 가 같은 데이터 소스 사용.
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
} from 'lucide-react'

export type MenuItem = { href: string; label: string; icon: typeof LayoutDashboard }

// v1.0 메뉴 (절대 보존)
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

// v1.1 메뉴
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

/** 활성 상태 판정 헬퍼 */
export function isMenuActive(itemHref: string, pathname: string): boolean {
  if (itemHref === '/') return pathname === '/'
  if (itemHref === '/finance') return pathname === '/finance'
  return pathname.startsWith(itemHref)
}
