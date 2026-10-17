import { useCallback, useEffect, useState } from 'react'
import api from '../lib/api.js'
import { getStoredToken, setStoredToken, clearStoredToken } from '../lib/tokenStorage.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => getStoredToken() !== null)

  useEffect(() => {
    if (!getStoredToken()) {
      return undefined
    }

    let active = true

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (active) {
          setUser(data.data.user)
        }
      })
      .catch(() => {
        if (active) {
          clearStoredToken()
          setUser(null)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setStoredToken(data.data.token)
    setUser(data.data.user)
    return data.data.user
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    setUser(data.data.user)
    return data.data.user
  }, [])

  const logout = useCallback(() => {
    clearStoredToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}