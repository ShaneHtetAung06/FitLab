'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import AvatarUploader from '@/components/AvatarUploader';
import PasswordField from '@/components/PasswordField';

const BIO_LIMIT = 500;
const NAME_LIMIT = 50;

function SectionHeading({ eyebrow, title, children }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-1.5 text-xl">{title}</h2>
      {children && <p className="mt-1.5 text-[13px] text-ink-500">{children}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading, updateUser } = useAuth();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState(null);
  const [avatarCleared, setAvatarCleared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);


  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!user || initialisedRef.current) return;
    initialisedRef.current = true;
    setName(user.name || '');
    setBio(user.bio || '');
    setPhone(user.phone || '');
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  if (!user) return null;

  const isDirty =
    name.trim() !== (user.name || '') ||
    bio.trim() !== (user.bio || '') ||
    phone.trim() !== (user.phone || '') ||
    Boolean(pendingAvatar) ||
    avatarCleared;

  const saveProfile = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error('Please provide your name');
      return;
    }

    setIsSaving(true);

    try {

      const body = { name: name.trim(), bio: bio.trim(), phone: phone.trim() };

      if (pendingAvatar) body.avatar = pendingAvatar;
      else if (avatarCleared) body.avatar = null;

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        // Updates the navbar name and avatar immediately.
        updateUser(data.user);
        setPendingAvatar(null);
        setAvatarCleared(false);
        toast.success(data.message || 'Profile updated');
      } else {
        toast.error(data.message || 'Could not update your profile');
      }
    } catch (error) {
      toast.error('Could not update your profile');
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Your new passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Your new password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success(data.message || 'Password changed');
      } else {
        toast.error(data.message || 'Could not change your password');
      }
    } catch (error) {
      toast.error('Could not change your password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <Link
        href="/dashboard"
        className="text-[13px] text-ink-500 transition-colors hover:text-primary-600"
      >
        ← Back to dashboard
      </Link>

      <div className="mt-4">
        <p className="eyebrow">Your account</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">Profile</h1>
        <p className="mt-1.5 text-[15px] text-ink-500">
          How you appear to trainers and learners across FitLab.
        </p>
      </div>

      {/* ------------------------------------------------------------ details */}
      <form onSubmit={saveProfile} className="card mt-8 p-6">
        <SectionHeading eyebrow="Details" title="Public profile">
          Your name and picture are shown on reviews, messages and, if you teach,
          your course pages.
        </SectionHeading>

        <div className="mt-6">
          <AvatarUploader
            currentUrl={user.avatar}
            pending={pendingAvatar}
            cleared={avatarCleared}
            name={name || user.name}
            disabled={isSaving}
            onUploaded={(file) => {
              setPendingAvatar(file);
              setAvatarCleared(false);
            }}
            onCleared={() => {
              setPendingAvatar(null);
              setAvatarCleared(true);
            }}
          />
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-[13px] font-medium text-ink-700"
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              maxLength={NAME_LIMIT}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
              placeholder="Your name"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="bio" className="text-[13px] font-medium text-ink-700">
                Bio
              </label>
              <span
                className={`text-[11px] ${
                  bio.length > BIO_LIMIT ? 'text-primary-600' : 'text-ink-400'
                }`}
              >
                {bio.length}/{BIO_LIMIT}
              </span>
            </div>
            <textarea
              id="bio"
              rows={5}
              maxLength={BIO_LIMIT}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="field resize-y"
              placeholder={
                user.role === 'trainer'
                  ? 'Your background, qualifications and who you work best with.'
                  : 'A short note about your goals. Optional.'
              }
            />
            {user.role === 'trainer' && (
              <p className="mt-1.5 text-[12px] text-ink-400">
                This appears on every course you publish.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-[13px] font-medium text-ink-700"
            >
              Phone <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              maxLength={30}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="field"
              placeholder="+66 12 345 6789"
            />
            <p className="mt-1.5 text-[12px] text-ink-400">
              Never shown publicly. Used only if support needs to reach you.
            </p>
          </div>

    
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[13px] font-medium text-ink-700"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={user.email}
              readOnly
              disabled
              className="field cursor-not-allowed bg-bone text-ink-500"
            />
            <p className="mt-1.5 text-[12px] text-ink-400">
              Your email is how you sign in and cannot be changed here.
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-5">
          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className="btn btn-primary btn-sm"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>

          {isDirty && !isSaving && (
            <button
              type="button"
              onClick={() => {
                setName(user.name || '');
                setBio(user.bio || '');
                setPhone(user.phone || '');
                setPendingAvatar(null);
                setAvatarCleared(false);
              }}
              className="text-[13px] font-medium text-ink-500 hover:text-ink-900"
            >
              Discard
            </button>
          )}

          {!isDirty && !isSaving && (
            <span className="text-[13px] text-ink-400">No unsaved changes</span>
          )}
        </div>
      </form>

      {/* ----------------------------------------------------------- password */}
      <form onSubmit={changePassword} className="card mt-6 p-6">
        <SectionHeading eyebrow="Security" title="Change password">
          You will need your current password. Changing it signs you out on every
          other device.
        </SectionHeading>

        <div className="mt-6 space-y-5">
          <PasswordField
            id="currentPassword"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />

          <PasswordField
            id="newPassword"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            hint={
              newPassword && newPassword.length < 6
                ? 'Must be at least 6 characters'
                : null
            }
          />

          <PasswordField
            id="confirmNewPassword"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="Repeat your new password"
            hint={
              confirmPassword && confirmPassword !== newPassword
                ? 'These do not match'
                : null
            }
          />
        </div>

        <div className="mt-7 border-t border-ink-100 pt-5">
          <button
            type="submit"
            disabled={
              isChangingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="btn btn-dark btn-sm"
          >
            {isChangingPassword ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>

      <section className="card mt-6 p-6">
        <SectionHeading eyebrow="Account" title="Account information" />

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
              Role
            </dt>
            <dd className="mt-1 text-[14px] capitalize text-ink-900">{user.role}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-eyebrow text-ink-400">
              Member since
            </dt>
            <dd className="mt-1 text-[14px] text-ink-900">{memberSince}</dd>
          </div>
        </dl>

        {user.role === 'customer' && (
          <div className="mt-5 border-t border-ink-100 pt-5">
            <p className="text-[13px] text-ink-500">
              Want to publish your own courses?
            </p>
            <Link
              href="/dashboard/become-trainer"
              className="btn btn-outline btn-sm mt-3"
            >
              Apply to become a trainer
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
