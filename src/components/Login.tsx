import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { Bot, Lock, User, Eye, EyeOff, Shield, Home, Sparkles, UserPlus } from 'lucide-react';
import { supabase } from '../services/database';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      onLogin();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          setMessage('Sign up successful! Please check your email for verification (or you can sign in directly in dev mode).');
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (data.session) {
          onLogin();
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setMessage('');
    setIsLoading(true);

    // Demo credentials - you can change these
    const demoEmail = 'demo@example.com';
    const demoPassword = 'demo123456';

    try {
      // Try to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError) {
        // If sign in fails, try to sign up
        const { error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
        });

        if (signUpError) throw signUpError;

        // Try to sign in again after signup
        const { error: retrySignInError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });

        if (retrySignInError) throw retrySignInError;
      }

      onLogin();
    } catch (error: any) {
      console.error('Demo login error:', error);
      setError(`Demo login failed: ${error.message}. Try signing up with your own email.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md relative backdrop-blur-sm bg-white/10 border-white/20 shadow-2xl">
        <CardHeader className="text-center pb-8">
          {/* Logo */}
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <div className="relative">
              <Bot className="w-10 h-10 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </div>
          
          {/* Title */}
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            AI Smart Home
          </CardTitle>
          <p className="text-gray-300 text-sm">
            Intelligent Home Management System
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-blue-400"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-blue-400"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign Up Toggle */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                disabled={isLoading}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-sm">
                {message}
              </div>
            )}

            {/* Login Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 transition-all duration-200 transform hover:scale-[1.02]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  {isSignUp ? <UserPlus className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
                </div>
              )}
            </Button>
          </form>

          {/* Demo Login */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-gray-400">or</span>
            </div>
          </div>

          <Button
            onClick={handleDemoLogin}
            variant="outline"
            className="w-full border-white/20 text-gray-200 hover:bg-white/10 transition-all duration-200"
            disabled={isLoading}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Try Demo Account
          </Button>

          {/* Features */}
          <div className="pt-4 border-t border-white/20">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="w-8 h-8 mx-auto bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xs text-gray-300">AI Assistant</p>
              </div>
              <div className="space-y-2">
                <div className="w-8 h-8 mx-auto bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-xs text-gray-300">Smart Control</p>
              </div>
              <div className="space-y-2">
                <div className="w-8 h-8 mx-auto bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-xs text-gray-300">Secure</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
        <p className="text-xs text-gray-400">
          AI Smart Home Management System v2.0
        </p>
      </div>
    </div>
  );
};