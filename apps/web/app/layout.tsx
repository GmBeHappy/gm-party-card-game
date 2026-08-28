import type { Metadata, Viewport } from 'next'
import { Itim, Mali, Nunito } from 'next/font/google'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

/** ตัวหนังสือทั้งหมดในเกม — ลายมือไทยกลมๆ */
const mali = Mali({
  variable: '--font-body',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
})

/** เก็บไว้ใช้เฉพาะชื่อเกมกับสองจังหวะที่ต้องดัง */
const itim = Itim({
  variable: '--font-display',
  subsets: ['thai', 'latin'],
  weight: '400',
})

/** ตัวเลข: จำนวนไพ่ คะแนน เวลา รหัสห้อง — ต้องเรียงตรงเป็นคอลัมน์ */
const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'สลาฟ',
  description: 'เกมไพ่สลาฟออนไลน์ สร้างห้อง แชร์รหัส แล้วเล่นกับเพื่อน',
}

export const viewport: Viewport = {
  themeColor: '#5fd08a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="th"
      className={`${mali.variable} ${itim.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
