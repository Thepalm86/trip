'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
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
      <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-16 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-indigo-50/30"></div>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%236366f1' fill-opacity='0.03'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10zm10 0c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10z'/%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        <div className="relative z-10 w-full max-w-md">
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
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
