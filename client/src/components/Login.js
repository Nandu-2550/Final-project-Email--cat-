import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Shield, Zap, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user) {
            navigate('/dashboard');
        }
    }, [user, loading, navigate]);

    const handleLogin = () => {
        window.location.href = 'http://localhost:5000/auth/google';
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden relative">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="z-10 text-center px-4"
            >
                <div className="flex justify-center mb-6">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-2xl shadow-blue-500/20">
                        <Mail size={48} className="text-white" />
                    </div>
                </div>
                
                <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    LiveMail Classifier
                </h1>
                
                <p className="text-gray-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto">
                    A premium, real-time email intelligence platform. 
                    Organize your life with AI-powered categorization and a sleek dark interface.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
                    {[
                        { icon: Shield, title: 'Secure', desc: 'OAuth2 Read-Only' },
                        { icon: Zap, title: 'Real-time', desc: 'Instant Delivery' },
                        { icon: BarChart3, title: 'AI Insights', desc: 'Smart Categories' }
                    ].map((feature, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + (i * 0.1) }}
                            className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-6 rounded-xl"
                        >
                            <feature.icon className="mx-auto mb-3 text-blue-400" size={24} />
                            <h3 className="font-semibold mb-1">{feature.title}</h3>
                            <p className="text-xs text-gray-500">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogin}
                    className="bg-white text-black font-bold py-4 px-8 rounded-full flex items-center gap-3 mx-auto shadow-xl hover:shadow-white/10 transition-all text-lg"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                    Login with Google
                </motion.button>
            </motion.div>

            {/* Particle effect simulation */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        animate={{
                            y: [0, -1000],
                            opacity: [0, 1, 0],
                        }}
                        transition={{
                            duration: Math.random() * 10 + 10,
                            repeat: Infinity,
                            delay: Math.random() * 20,
                        }}
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: '110%',
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default Login;
