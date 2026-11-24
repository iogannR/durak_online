import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail } from 'lucide-react';
import { AuthMode, UserAccount } from '../types/durak';
import { AVATAR_PRESETS } from '../data/presets';
import { ApiError, isBackendEnabled } from '../api/client';
import { authApi } from '../api/durakApi';

interface AuthViewProps {
  accounts: UserAccount[];
  onLogin: (account: UserAccount) => void;
  onRegister: (newAccount: UserAccount) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthView: React.FC<AuthViewProps> = ({
  accounts,
  onLogin,
  onRegister,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState('');

  // Recovery (Backend handles email confirmation)
  const [recEmail, setRecEmail] = useState('');
  const [recSent, setRecSent] = useState(false);
  const [recError, setRecError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const query = loginIdentifier.trim();
    if (!query || !loginPassword) {
      setLoginError('Введите логин или почту и пароль.');
      return;
    }

    if (isBackendEnabled()) {
      setIsSubmitting(true);
      try {
        const account = await authApi.login(query, loginPassword);
        onLogin(account);
      } catch (err) {
        setLoginError(
          err instanceof ApiError ? err.message : 'Не удалось выполнить вход.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const lowerQuery = query.toLowerCase();
    const found = accounts.find(
      (a) =>
        a.email.toLowerCase() === lowerQuery ||
        a.username.toLowerCase() === lowerQuery
    );
    if (!found || found.passwordHash !== loginPassword) {
      setLoginError('Неверный логин, почта или пароль.');
      return;
    }
    onLogin(found);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    const cleanName = regUsername.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (cleanName.length < 3) {
      setRegError('Имя должно быть не короче 3 символов.');
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setRegError('Укажите корректную почту.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Пароль должен содержать минимум 6 символов.');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Пароли не совпадают.');
      return;
    }

    if (isBackendEnabled()) {
      setIsSubmitting(true);
      try {
        const created = await authApi.register(cleanName, cleanEmail, regPassword);
        onRegister(created);
      } catch (err) {
        setRegError(
          err instanceof ApiError ? err.message : 'Не удалось создать аккаунт.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const duplicate = accounts.some(
      (a) =>
        a.email.toLowerCase() === cleanEmail ||
        a.username.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setRegError('Такой ник или почта уже заняты.');
      return;
    }

    onRegister({
      id: `acc-${Date.now()}`,
      username: cleanName,
      email: cleanEmail,
      passwordHash: regPassword,
      avatarUrl: AVATAR_PRESETS[0].url,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError('');
    setRecSent(false);
    const cleanEmail = recEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setRecError('Введите корректный адрес почты.');
      return;
    }

    if (isBackendEnabled()) {
      setIsSubmitting(true);
      try {
        await authApi.requestPasswordRecovery(cleanEmail);
        setRecSent(true);
      } catch (err) {
        setRecError(
          err instanceof ApiError ? err.message : 'Ошибка отправки письма.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setRecSent(true);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <div className="bg-[#151C19] border border-white/10 rounded-xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/10">
          <h1 className="text-2xl font-semibold text-[#F3EFE6]">
            {mode === 'login' && 'Вход'}
            {mode === 'register' && 'Регистрация'}
            {mode === 'recovery' && 'Сброс пароля'}
          </h1>

          <div className="flex items-center gap-1 p-1 bg-[#0F1412] rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-[#222E29] text-[#F3EFE6]' : 'text-[#94A099] hover:text-[#F3EFE6]'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'register' ? 'bg-[#222E29] text-[#F3EFE6]' : 'text-[#94A099] hover:text-[#F3EFE6]'
              }`}
            >
              Новый
            </button>
          </div>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-[#D6D0C4] mb-1.5">Никнейм или почта</label>
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="matvey@univ.ru"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-[#D6D0C4]">Пароль</label>
                <button
                  type="button"
                  onClick={() => {
                    setRecSent(false);
                    setRecError('');
                    setMode('recovery');
                  }}
                  className="text-xs text-[#D6A954] hover:underline"
                >
                  Забыли пароль?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Пароль"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Показать или скрыть пароль"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A099] hover:text-[#F3EFE6]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && <p className="text-xs text-[#F28B82]">{loginError}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#D6A954] text-[#111714] font-semibold text-sm hover:bg-[#E1B96B] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
            >
              Войти
              <ArrowRight className="w-4 h-4" />
            </button>

            {!isBackendEnabled() && accounts.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => onLogin(accounts[0])}
                  className="w-full py-2 px-3 rounded-lg border border-white/10 text-xs text-[#94A099] hover:text-[#F3EFE6] hover:border-white/25 transition-colors"
                >
                  Быстрый вход: {accounts[0].username}
                </button>
              </div>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-[#D6D0C4] mb-1.5">Никнейм</label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="От 3 символов"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#D6D0C4] mb-1.5">Электронная почта</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="student@univ.ru"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94A099] mb-1.5">Пароль</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="От 6 симв."
                  className="w-full px-3 py-2 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A099] mb-1.5">Повтор</label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="Ещё раз"
                  className="w-full px-3 py-2 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
                />
              </div>
            </div>

            {regError && <p className="text-xs text-[#F28B82]">{regError}</p>}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#D6A954] text-[#111714] font-semibold text-sm hover:bg-[#E1B96B] transition-colors"
            >
              Создать аккаунт
            </button>
          </form>
        )}

        {mode === 'recovery' && (
          <form onSubmit={handleSendRecovery} className="mt-6 space-y-4">
            <p className="text-xs text-[#94A099] leading-relaxed">
              Укажите привязанную почту. Сервер отправит письмо со ссылкой для сброса пароля.
            </p>
            <div>
              <label className="block text-sm text-[#D6D0C4] mb-1.5">Почта</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#94A099] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  placeholder="matvey@univ.ru"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
                />
              </div>
            </div>

            {recError && <p className="text-xs text-[#F28B82]">{recError}</p>}
            {recSent && (
              <p className="text-xs text-[#A5E1BF] bg-[#1E4433]/50 border border-[#7CD4A0]/30 rounded-lg px-3 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Код восстановления отправлен на {recEmail.trim().toLowerCase()}.
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#D6A954] text-[#111714] font-semibold text-sm hover:bg-[#E1B96B] transition-colors"
              >
                Отправить код
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="py-2.5 px-4 rounded-lg border border-white/15 text-sm text-[#D6D0C4] hover:bg-white/5"
              >
                Назад
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
