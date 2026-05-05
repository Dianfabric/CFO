'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  FileText,
  PieChart,
  Sparkles,
  Upload as UploadIcon,
  Layers,
  Target as TargetIcon,
  Coins,
  Layers3,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import AuthPill from '@/components/v11/AuthPill'

type MenuItem = { href: string; label: string; icon: typeof LayoutDashboard }

// v1.0 기존 11개 메뉴 (절대 보존)
const v10MenuItems: MenuItem[] = [
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

// v1.1 신규 메뉴 (Phase 1부터 단계 추가)
const v11MenuItems: MenuItem[] = [
  { href: '/finance', label: '재무 메인 (v1.1)', icon: PieChart },
  { href: '/finance/decomposition', label: '매출 인수분해', icon: Layers },
  { href: '/finance/expenses', label: '자원 인수분해', icon: Coins },
  { href: '/finance/positioning', label: '포지셔닝 매트릭스', icon: Layers3 },
  { href: '/finance/pricing', label: '4단계 가격 결정', icon: Workflow },
  { href: '/finance/cycle', label: '12주 대시보드', icon: TargetIcon },
  { href: '/finance/upload', label: '일계표 업로드', icon: UploadIcon },
  { href: '/finance/clients', label: '거래처 관리 (v1.1)', icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 sticky top-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            <span className="font-bold text-lg">CFO</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-slate-700 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* v1.0 메뉴 */}
        <ul className="space-y-1 px-2">
          {v10MenuItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* v1.1 섹션 구분선 + 헤더 */}
        <div className="my-4 px-2">
          <div className="border-t border-slate-700" />
          {!collapsed && (
            <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
                v1.1 신규
              </span>
            </div>
          )}
        </div>

        {/* v1.1 메뉴 */}
        <ul className="space-y-1 px-2">
          {v11MenuItems.map((item) => {
            // /finance 는 정확히 일치할 때만 활성 (하위 /finance/upload 는 별개 메뉴)
            const isActive =
              item.href === '/finance'
                ? pathname === '/finance'
                : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* v1.1 인증 영역 */}
        <div className="mt-3 px-2">
          <div className="border-t border-slate-700/50 pt-2">
            <AuthPill collapsed={collapsed} />
          </div>
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-700">
          <p className="text-xs text-slate-400 text-center">
            디안 CFO · v1.0 + v1.1
          </p>
        </div>
      )}
    </aside>
  )
}
