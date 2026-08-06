"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      login(data.username, data.role, data.access_token);
    } catch (err: any) {
      setError(err.message || "Could not connect to authentication server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-md">
        <div className="text-center mb-6">
          <h1 className="text-lg font-semibold text-white">
            UrbanPulse
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Sign in to access dashboard analytics
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded border border-red-800 bg-red-950/50 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-xs font-medium text-zinc-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-zinc-200 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-300 focus:outline-none disabled:opacity-50 mt-2"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-500">
          <p className="font-mono text-zinc-400">All authentication sessions use salted PBKDF2 hashing & HMAC tokens.</p>
        </div>
      </div>
    </div>
  );
}
