import React from 'react';
import { supabase } from '../supabaseClient';
import { IconMap } from '../components/IconMap';

export default function LoginView() {
    const handleGoogleLogin = async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) console.error('Error logging in:', error.message);
    };

    const { LayoutDashboard } = IconMap;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f1115] p-4 text-slate-800 dark:text-slate-200">
            <div className="max-w-md w-full p-8 rounded-[2rem] text-center space-y-6 bg-white dark:bg-[#1a1c23] shadow-xl border border-slate-200 dark:border-white/10 slide-up">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <LayoutDashboard className="w-10 h-10 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-black mb-3">올라운더 시작하기</h1>
                    <p className="text-[15px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">데이터를 클라우드에 안전하게 보관하고<br />스마트폰 컴퓨터 어디서든 관리하세요.</p>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full py-4 px-4 mt-8 bg-white dark:bg-[#13151a] border border-slate-200 dark:border-white/10 rounded-2xl font-black text-[15px] flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm active:scale-[0.98]"
                >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google 계정으로 계속하기
                </button>

                <p className="text-xs font-bold text-slate-400 mt-6 tracking-tight">수파베이스 환경변수(.env.local) 세팅 확인용 화면입니다.</p>
            </div>
        </div>
    );
}
