import { CustomToast, ToastProvider } from '@t4/ui'
import { ToastViewport } from './toast-viewport'
import { TRPCProvider } from './trpc'
import { SafeAreaProvider } from './safe-area'
import { TamaguiThemeProvider } from './theme'
import { TamaguiProvider } from './tamagui'
import { SolitoImageProvider } from './solito-image'
import { Session } from '@supabase/supabase-js'
import { AuthProvider } from './auth'

export function Provider({
  children,
  initialSession,
}: {
  children: React.ReactNode
  initialSession: Session | null
}) {
  return (
    <AuthProvider initialSession={initialSession}>
      <TamaguiThemeProvider>
        <TamaguiProvider>
          <SafeAreaProvider>
            <SolitoImageProvider>
              <ToastProvider swipeDirection="horizontal" duration={6000} native={['mobile']}>
                <TRPCProvider>{children}</TRPCProvider>
                <CustomToast />
                <ToastViewport />
              </ToastProvider>
            </SolitoImageProvider>
          </SafeAreaProvider>
        </TamaguiProvider>
      </TamaguiThemeProvider>
    </AuthProvider>
  )
}
