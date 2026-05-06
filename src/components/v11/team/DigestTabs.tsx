'use client'
/**
 * 일일/주간/월간 디지스트 미리보기 탭
 */
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DigestPreview from './DigestPreview'

interface Props {
  daily: string
  weekly: string
  monthly: string
}

export default function DigestTabs({ daily, weekly, monthly }: Props) {
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'daily' | 'weekly' | 'monthly')}>
      <TabsList>
        <TabsTrigger value="daily">📅 일일</TabsTrigger>
        <TabsTrigger value="weekly">📈 주간</TabsTrigger>
        <TabsTrigger value="monthly">📊 월간</TabsTrigger>
      </TabsList>

      <TabsContent value="daily" className="mt-4">
        <DigestPreview kind="daily" text={daily} defaultChannel="employees" />
      </TabsContent>
      <TabsContent value="weekly" className="mt-4">
        <DigestPreview kind="weekly" text={weekly} defaultChannel="employees" />
      </TabsContent>
      <TabsContent value="monthly" className="mt-4">
        <DigestPreview
          kind="monthly"
          text={monthly}
          defaultChannel="executives"
          channels={['executives', 'ceo']}
        />
      </TabsContent>
    </Tabs>
  )
}
