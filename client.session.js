window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.session.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))

    const React = require('react')
    const { createElement: h, useCallback, useEffect, useState } = React
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { createSnapshotStore } = require('@deepseek-ai/dsh-client-store')
    const { Button, IconTrashOutlineRegular, MenuItemButton, Modal } = primitives

    const SESSION_ROUTE = '/api/dsh-plus-plus/sessions'
    const ORDER = 500
    const NS = 'settings.plusPlus'
    const DELETE_ACTION_CLASS = 'pp-delete-action'

    const requestStore = createSnapshotStore(null)

    const deleteRequestSource = {
      subscribe: (listener) => requestStore.subscribe(listener),
      getSnapshot: () => requestStore.getSnapshot(),
    }

    const DICT = {
      zh: {
        'title': '删除会话',
        'subtitle': '会话「更多选项」菜单新增删除项，删除后本地记录不可恢复。',
        'menu.deleteSession': '删除会话',
        'confirm.title': '删除会话？',
        'confirm.desc': '「{title}」的本地记录将被永久删除，此操作无法撤销。',
        'confirm.action': '删除',
        'confirm.cancel': '取消',
        'confirm.pending': '正在删除…',
        'confirm.close': '关闭',
        'confirm.error': '删除失败：{reason}',
      },
      en: {
        'title': 'Delete session',
        'subtitle': 'Adds a delete entry to the session overflow menu. The local record is removed for good.',
        'menu.deleteSession': 'Delete session',
        'confirm.title': 'Delete this session?',
        'confirm.desc': 'The local record for {title} will be permanently deleted. This cannot be undone.',
        'confirm.action': 'Delete',
        'confirm.cancel': 'Cancel',
        'confirm.pending': 'Deleting…',
        'confirm.close': 'Close',
        'confirm.error': 'Could not delete: {reason}',
      },
    }

    async function requestDelete(sessionId) {
      const response = await fetch(`${SESSION_ROUTE}/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(body.trim() === '' ? `HTTP ${response.status}` : body.trim())
      }
    }

    function DeleteConfirmDialog({ request, onSettle, t }) {
      const [deleting, setDeleting] = useState(false)
      const [error, setError] = useState(null)

      useEffect(() => {
        setDeleting(false)
        setError(null)
      }, [request.sessionId])

      const close = useCallback(() => {
        if (deleting) return
        onSettle()
      }, [deleting, onSettle])

      const confirm = useCallback(() => {
        setDeleting(true)
        setError(null)
        requestDelete(request.sessionId).then(
          () => { setDeleting(false); onSettle() },
          (reason) => {
            setDeleting(false)
            setError(reason instanceof Error ? reason.message : String(reason))
          },
        )
      }, [request.sessionId, onSettle])

      return h(Modal, {
        open: true,
        onClose: close,
        closeLabel: t('session.confirm.close'),
        title: t('session.confirm.title'),
        description: t('session.confirm.desc', { title: request.displayTitle }),
        footer: h(React.Fragment, null, [
          h(Button, {
            key: 'cancel',
            variant: 'outline',
            disabled: deleting,
            onClick: close,
          }, t('session.confirm.cancel')),
          h(Button, {
            key: 'confirm',
            variant: 'outline',
            className: DELETE_ACTION_CLASS,
            disabled: deleting,
            onClick: confirm,
          }, t('session.confirm.action')),
        ]),
      }, [
        deleting && h('div', {
          key: 'pending',
          role: 'status',
          style: { marginTop: 8, fontSize: 12, opacity: 0.75 },
        }, t('session.confirm.pending')),
        error !== null && h('div', {
          key: 'error',
          role: 'alert',
          style: { marginTop: 8, fontSize: 12, color: 'var(--dsw-alias-state-error-primary, #d03050)' },
        }, t('session.confirm.error', { reason: error })),
      ])
    }

    function DeleteSessionMenuItem({ sessionId, displayTitle, raiseDeleteRequest, useMenuOpenState, t }) {
      const [, setMenuOpen] = useMenuOpenState()
      return h(MenuItemButton, {
        danger: true,
        shortcut: undefined,
        icon: h(IconTrashOutlineRegular, { size: 14 }),
        onSelect: () => {
          setMenuOpen(false)
          raiseDeleteRequest({ sessionId, displayTitle })
        },
      }, t('session.menu.deleteSession'))
    }

    function DeleteSessionDialog({ useDeleteRequest, clearDeleteRequest, t }) {
      const request = useDeleteRequest(pending => pending)
      if (request === null || request === undefined) return null
      return h(DeleteConfirmDialog, { request, onSettle: clearDeleteRequest, t })
    }

    const CSS = `
.pp-delete-action.pp-delete-action {
  color: var(--dsw-alias-state-error-primary, #d03050);
  border-color: var(--dsw-alias-state-error-primary, #d03050);
}

.pp-delete-action.pp-delete-action:hover:not(:disabled) {
  background: rgb(208 48 80 / 12%);
}
`.trim()

    function Settings({ t }) {
      return h('div', { className: 'pp-section' }, [
        h('h2', { className: 'pp-title' }, t('title')),
        h('p', { className: 'pp-sub' }, t('subtitle')),
      ])
    }

    const deleteInjected = () => ({
      raiseDeleteRequest: (request) => requestStore.set(request),
    })

    const overlayInjected = () => ({
      hooks: { deleteRequest: deleteRequestSource },
      clearDeleteRequest: () => requestStore.set(null),
    })

    exports.id = 'dsh-plus-plus/client.session.js'
    exports.descriptor = {
      id: 'session',
      group: 'ui',
      order: 35,
      locale: DICT,
      css: CSS,
      title: 'session.title',
      settings: Settings,
      async apply(ctx) {
        const { registerStyles } = await core()
        registerStyles(ctx, CSS, 'session')

        ctx.effect(() => {
          ctx.slots.inject('sidebar.workspaces.session.menu.item', function* () {
            yield ctx.slots.register({
              name: 'sidebar.workspaces.session.menu.item',
              id: 'plus-plus.delete-session',
              order: ORDER,
              inject: deleteInjected,
              locale: NS,
            }, DeleteSessionMenuItem)
          })

          ctx.slots.inject('shell.overlay', function* () {
            yield ctx.slots.register({
              name: 'shell.overlay',
              id: 'plus-plus.session-delete',
              inject: overlayInjected,
              locale: NS,
            }, DeleteSessionDialog)
          })
        }, 'dsh-plus-plus: session delete')
      },
    }

    return module.exports
  },
})
