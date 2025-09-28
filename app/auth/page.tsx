'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { signUp, signIn } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
        } else {
          setSuccess('Account created successfully! You can now sign in.')
          setIsSignUp(false)
          setPassword('')
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          // Redirect to main app
          router.push('/')
        }
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    setError('')
    setSuccess('')
    setOauthLoading(provider)

    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider })
      if (error) {
        setError(error.message)
        setOauthLoading(null)
      }
      // Successful sign-in triggers an external redirect handled by Supabase.
    } catch {
      setError('Unable to start social sign-in right now. Please try again.')
      setOauthLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - App Description */}
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/10 to-indigo-900/20"></div>
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        {/* Content */}
        <div className="relative z-10 h-full flex items-center px-16">
          <div className="max-w-lg">
            {/* App Logo and Name */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-light text-white tracking-wide">Traveal</h1>
                <p className="text-white/60 text-sm font-light">Travel Planning Platform</p>
              </div>
            </div>
            
            {/* Main Headline */}
            <h2 className="text-4xl font-light text-white leading-tight mb-6 tracking-tight">
              Transform Your Travel Dreams Into Extraordinary Journeys
            </h2>
            
            {/* Subheading */}
            <p className="text-lg text-white/80 leading-relaxed mb-8 font-light">
              Our intelligent platform crafts personalized itineraries that capture the essence of every destination, 
              combining artificial intelligence with curated local expertise.
            </p>
            
            {/* Features */}
            <div className="space-y-6">
              <div className="border-l-2 border-white/20 pl-4">
                <h3 className="text-base font-medium text-white mb-1">Intelligent Recommendations</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Discover hidden gems and local experiences tailored to your preferences.
                </p>
              </div>
              
              <div className="border-l-2 border-white/20 pl-4">
                <h3 className="text-base font-medium text-white mb-1">Seamless Collaboration</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Plan together with friends and family in real-time.
                </p>
              </div>
              
              <div className="border-l-2 border-white/20 pl-4">
                <h3 className="text-base font-medium text-white mb-1">Professional Documentation</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Beautiful maps and detailed guides for every adventure.
                </p>
              </div>
            </div>
            
            {/* Trust Indicators */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-white/60 text-xs font-light mb-1">Trusted by discerning travelers worldwide</p>
              <div className="flex items-center gap-4 text-white/50 text-xs">
                <span>Secure</span>
                <span>•</span>
                <span>Private</span>
                <span>•</span>
                <span>Reliable</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Sign In Form */}
      <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-20 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-indigo-50/30"></div>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%236366f1' fill-opacity='0.03'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10zm10 0c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10z'/%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        <div className="relative z-10 w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-light text-slate-800 mb-3">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-slate-600 font-light">
              {isSignUp ? 'Join our community of travelers' : 'Sign in to continue your journey'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-10">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={oauthLoading !== null}
                className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-semibold transition-all duration-200 hover:border-blue-500/60 hover:text-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  <svg className="h-5 w-5" viewBox="0 0 533.5 544.3" aria-hidden="true">
                    <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272.1v95.3h147c-6.3 34-25 62.8-53.4 82.1v68.1h86.4c50.6-46.6 81.4-115.2 81.4-195.1z" />
                    <path fill="#34A853" d="M272.1 544.3c72.6 0 133.6-24 178.2-65.3l-86.4-68.1c-24 16.1-54.7 25.6-91.8 25.6-70.5 0-130.3-47.6-151.7-111.4H30.4v69.9c44.2 87.6 135.1 149.3 241.7 149.3z" />
                    <path fill="#FBBC05" d="M120.4 324.7c-10.6-31.4-10.6-65.3 0-96.7v-69.9H30.4c-44.6 87.6-44.6 191 0 278.5l90-69.9z" />
                    <path fill="#EA4335" d="M272.1 214.2c38.9-.6 76.1 14.7 104.1 41l77.7-77.7c-47.1-43.8-108.9-68.8-181.8-68.8-106.6 0-197.5 61.7-241.7 149.3l90 69.9c21.3-63.8 81.1-111.4 151.7-111.4z" />
                  </svg>
                </span>
                {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn('facebook')}
                disabled={oauthLoading !== null}
                className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-semibold transition-all duration-200 hover:border-blue-500/60 hover:text-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1877F2]">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M22.675 0H1.325C.593 0 0 .593 0 1.326v21.348C0 23.407.593 24 1.325 24h11.494v-9.294H9.691v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.764v2.313h3.587l-.467 3.622h-3.12V24h6.117C23.407 24 24 23.407 24 22.674V1.326C24 .593 23.407 0 22.675 0z" />
                  </svg>
                </span>
                {oauthLoading === 'facebook' ? 'Redirecting…' : 'Continue with Facebook'}
              </button>
            </div>

            <div className="my-6 flex items-center gap-3 text-slate-400 text-xs uppercase tracking-[0.2em]">
              <span className="flex-1 h-px bg-slate-200" />
              Email
              <span className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-3">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-3">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-slate-900 placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50"
                  placeholder="Enter your password"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50/80 border border-red-200/50 rounded-xl backdrop-blur-sm">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50/80 border border-green-200/50 rounded-xl backdrop-blur-sm">
                  <p className="text-sm text-green-600 font-medium">{success}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="text-center">
                <span className="text-slate-600 text-sm">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </span>
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError('')
                    setSuccess('')
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200 text-sm underline hover:no-underline"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
