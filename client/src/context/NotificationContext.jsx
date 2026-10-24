import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { getSocket, disconnectSocket } from '../lib/socket.js'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/notificationApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { NotificationContext } from './notificationContext.js'

const RECENT_LIMIT = 5

function emptyState(ownerId = null) {
  return {
    ownerId,
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
  }
}

export function NotificationProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id || null
  const [state, setState] = useState(() => emptyState())
  const requestVersion = useRef(0)

  const refresh = useCallback(() => {
    if (!userId) {
      return Promise.resolve(null)
    }

    requestVersion.current += 1
    const version = requestVersion.current

    setState((current) => ({
      ...(current.ownerId === userId ? current : emptyState(userId)),
      ownerId: userId,
      loading: true,
      error: null,
    }))

    return getNotifications({ limit: RECENT_LIMIT })
      .then((response) => {
        if (requestVersion.current !== version) {
          return null
        }

        const data = response.data.data
        setState({
          ownerId: userId,
          notifications: Array.isArray(data.notifications)
            ? data.notifications
            : [],
          unreadCount: data.unreadCount || 0,
          loading: false,
          error: null,
        })
        return data
      })
      .catch((error) => {
        if (requestVersion.current !== version) {
          return null
        }

        setState((current) => ({
          ...(current.ownerId === userId ? current : emptyState(userId)),
          ownerId: userId,
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load notifications right now.',
          ),
        }))
        return null
      })
  }, [userId])

  useEffect(() => {
    if (authLoading) {
      return undefined
    }

    if (!userId) {
      requestVersion.current += 1
      disconnectSocket()
      return undefined
    }

    let active = true
    Promise.resolve().then(() => {
      if (active) {
        refresh()
      }
    })

    return () => {
      active = false
      requestVersion.current += 1
    }
  }, [authLoading, userId, refresh])

  useEffect(() => {
    if (authLoading || !userId) {
      return undefined
    }

    const socket = getSocket()
    if (!socket) {
      return undefined
    }

    let active = true
    let wasConnected = socket.connected

    const handleNotification = (notification) => {
      if (!active || !notification || !notification.id) {
        return
      }

      setState((current) => {
        if (current.ownerId && current.ownerId !== userId) {
          return current
        }

        const existing = current.notifications.some(
          (item) => item.id === notification.id,
        )
        if (existing) {
          return current
        }

        return {
          ...current,
          ownerId: userId,
          notifications: [notification, ...current.notifications].slice(
            0,
            RECENT_LIMIT,
          ),
          unreadCount:
            current.unreadCount + (notification.isRead ? 0 : 1),
        }
      })
    }

    const handleConnect = () => {
      if (active && wasConnected) {
        refresh()
      }
      wasConnected = true
    }

    socket.on('notification:new', handleNotification)
    socket.on('connect', handleConnect)

    return () => {
      active = false
      socket.off('notification:new', handleNotification)
      socket.off('connect', handleConnect)
    }
  }, [authLoading, userId, refresh])

  const markRead = useCallback(
    async (notificationId) => {
      const response = await markNotificationRead(notificationId)
      const data = response.data.data

      setState((current) => {
        if (current.ownerId !== userId) {
          return current
        }
        return {
          ...current,
          notifications: current.notifications.map((notification) =>
            notification.id === notificationId
              ? { ...notification, isRead: true }
              : notification,
          ),
          unreadCount: data.unreadCount,
        }
      })

      return data.notification
    },
    [userId],
  )

  const markAllRead = useCallback(async () => {
    const response = await markAllNotificationsRead()
    const data = response.data.data

    setState((current) => {
      if (current.ownerId !== userId) {
        return current
      }
      return {
        ...current,
        notifications: current.notifications.map((notification) => ({
          ...notification,
          isRead: true,
        })),
        unreadCount: 0,
      }
    })

    return data
  }, [userId])

  const ownerMatches = Boolean(userId) && state.ownerId === userId

  return (
    <NotificationContext.Provider
      value={{
        notifications: ownerMatches ? state.notifications : [],
        unreadCount: ownerMatches ? state.unreadCount : 0,
        loading: ownerMatches ? state.loading : Boolean(userId),
        error: ownerMatches ? state.error : null,
        refresh,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
