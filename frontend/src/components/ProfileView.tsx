import React, { useRef, useState } from 'react';
import { Check, LogOut, Mail, Upload } from 'lucide-react';
import { UserAccount } from '../types/durak';
import { AVATAR_PRESETS } from '../data/presets';
import { ApiError, isBackendEnabled } from '../api/client';
import { profileApi } from '../api/durakApi';
import { AuthView } from './AuthView';

interface ProfileViewProps {
  user: UserAccount | null;
  accounts: UserAccount[];
  onLogin: (account: UserAccount) => void;
  onRegister: (newAccount: UserAccount) => void;
  onUpdateProfile: (updates: Partial<UserAccount>) => void;
  onLogout: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  accounts,
  onLogin,
  onRegister,
  onUpdateProfile,
  onLogout,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [username, setUsername] = useState(user?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? AVATAR_PRESETS[0].url);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Simplified email re-binding & password change (backend processes via email)
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [emailStatus, setEmailStatus] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordCodeStatus, setPasswordCodeStatus] = useState('');
  const [passwordCodeError, setPasswordCodeError] = useState('');

  if (!user) {
    return <AuthView accounts={accounts} onLogin={onLogin} onRegister={onRegister} />;
  }

  const winRate =
    user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice('');
    setProfileError('');
    const cleanName = username.trim();
    if (cleanName.length < 3 || cleanName.length > 24) {
      setProfileError('Имя должно быть от 3 до 24 символов.');
      return;
    }

    if (isBackendEnabled()) {
      setIsSavingProfile(true);
      try {
        const updated = await profileApi.updateProfile({
          username: cleanName,
          avatarUrl,
        });
        onUpdateProfile(updated);
        setProfileNotice('Сохранено');
      } catch (err) {
        setProfileError(
          err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.'
        );
      } finally {
        setIsSavingProfile(false);
      }
      return;
    }

    onUpdateProfile({ username: cleanName, avatarUrl });
    setProfileNotice('Сохранено');
  };

  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus('');
    setEmailError('');
    const clean = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(clean)) {
      setEmailError('Введите корректный адрес почты.');
      return;
    }

    if (isBackendEnabled()) {
      try {
        const res = await profileApi.requestEmailRebind(clean);
        setEmailStatus(
          res.message ||
            `Код подтверждения отправлен на ${clean}. Завершите перепривязку в письме.`
        );
      } catch (err) {
        setEmailError(
          err instanceof ApiError ? err.message : 'Не удалось отправить код.'
        );
      }
      return;
    }

    setEmailStatus(`Код подтверждения отправлен на ${clean}. Завершите перепривязку в письме.`);
  };

  const handleSendPasswordCode = async () => {
    setPasswordCodeStatus('');
    setPasswordCodeError('');
    if (isBackendEnabled()) {
      try {
        const res = await profileApi.requestPasswordChangeCode();
        setPasswordCodeStatus(
          res.message ||
            `Код для смены пароля отправлен на ${user.email}. Дальнейшие шаги — в письме.`
        );
      } catch (err) {
        setPasswordCodeError(
          err instanceof ApiError ? err.message : 'Не удалось отправить код.'
        );
      }
      return;
    }

    setPasswordCodeStatus(
      `Код для смены пароля отправлен на ${user.email}. Дальнейшие шаги — в письме.`
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      {/* Header + Logout */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <img
            src={avatarUrl}
            alt={user.username}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-full object-cover scale-105 border-2 border-[#D6A954]/60"
          />
          <div>
            <h1 className="text-2xl font-semibold text-[#F3EFE6]">{user.username}</h1>
            <p className="text-sm text-[#94A099] tabular-nums">
              {user.email} · {user.gamesPlayed} партий · {winRate}% побед
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 rounded-lg border border-white/15 text-sm text-[#D6D0C4] hover:border-[#C93838] hover:text-[#F28B82] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>

      {/* Name & Avatar */}
      <section className="bg-[#151C19] border border-white/10 rounded-xl p-6">
        <h2 className="text-base font-semibold text-[#F3EFE6]">Имя и аватар</h2>
        <form onSubmit={handleSaveIdentity} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAvatarUrl(preset.url)}
                className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-transform ${
                  avatarUrl === preset.url
                    ? 'border-[#D6A954] scale-105'
                    : 'border-white/15 opacity-70 hover:opacity-100'
                }`}
                title={preset.label}
              >
                <img
                  src={preset.url}
                  alt={preset.label}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover scale-110"
                />
              </button>
            ))}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-lg border border-white/15 text-xs text-[#D6D0C4] hover:border-[#D6A954] inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Свой файл
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Имя игрока"
              className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#0F1412] border border-white/15 text-[#F3EFE6] text-sm focus:outline-none focus:border-[#D6A954]"
            />
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-5 py-2.5 rounded-lg bg-[#D6A954] text-[#111714] font-semibold text-sm hover:bg-[#E1B96B] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              Сохранить
            </button>
          </div>

          {profileError && <p className="text-xs text-[#F28B82]">{profileError}</p>}
          {profileNotice && (
            <p className="text-xs text-[#7CD4A0] inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {profileNotice}
            </p>
          )}
        </form>
      </section>

      {/* Email Rebind & Password Reset via Backend Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <section className="bg-[#151C19] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F3EFE6]">Перепривязка почты</h2>
            <p className="text-xs text-[#94A099] mt-1">
              Укажите новый адрес и нажмите «Отправить код» — подтверждение придёт на почту.
            </p>
            <form onSubmit={handleSendEmailCode} className="mt-4 space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-[#94A099] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0F1412] border border-white/15 text-sm text-[#F3EFE6] focus:outline-none focus:border-[#D6A954]"
                />
              </div>
              {emailError && <p className="text-xs text-[#F28B82]">{emailError}</p>}
              {emailStatus && <p className="text-xs text-[#A5E1BF]">{emailStatus}</p>}
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg border border-white/15 text-sm font-medium text-[#F3EFE6] hover:border-[#D6A954] transition-colors"
              >
                Отправить код
              </button>
            </form>
          </div>
        </section>

        <section className="bg-[#151C19] border border-white/10 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F3EFE6]">Смена пароля</h2>
            <p className="text-xs text-[#94A099] mt-1">
              Отправим одноразовый код на {user.email}, дальнейшая смена выполняется по ссылке из письма.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {passwordCodeError && (
              <p className="text-xs text-[#F28B82]">{passwordCodeError}</p>
            )}
            {passwordCodeStatus && (
              <p className="text-xs text-[#A5E1BF]">{passwordCodeStatus}</p>
            )}
            <button
              type="button"
              onClick={handleSendPasswordCode}
              className="w-full py-2 px-4 rounded-lg border border-white/15 text-sm font-medium text-[#F3EFE6] hover:border-[#D6A954] transition-colors"
            >
              Отправить код
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
