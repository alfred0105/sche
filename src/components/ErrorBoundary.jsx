/**
 * @fileoverview ErrorBoundary component for graceful error handling.
 * Prevents white-screen crashes by catching React render errors.
 */
import React from 'react';
import PropTypes from 'prop-types';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    className="min-h-screen flex items-center justify-center bg-[#09090b] p-4"
                    role="alert"
                    aria-live="assertive"
                >
                    <div className="max-w-md w-full bg-[#111113] rounded-xl p-8 shadow-none border border-white/10 text-center space-y-5">
                        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-xl mx-auto flex items-center justify-center">
                            <span className="text-2xl md:text-3xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-100">
                            예상치 못한 오류가 발생했습니다
                        </h2>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            앱에 문제가 생겼습니다. 아래 버튼을 눌러 다시 시도해주세요.
                            문제가 지속되면 브라우저 캐시를 비워주세요.
                        </p>
                        {this.state.error && (
                            <details className="text-left bg-[#09090b] p-3 rounded-xl border border-white/10">
                                <summary className="text-xs font-bold text-slate-400 cursor-pointer">
                                    오류 상세 정보
                                </summary>
                                <pre className="text-[10px] text-rose-500 mt-2 overflow-auto max-h-32">
                                    {this.state.error.toString()}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={this.handleReset}
                            className="w-full py-2.5 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-xl shadow-none hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors active:scale-95"
                        >
                            다시 시도하기
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
