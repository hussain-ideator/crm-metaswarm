'use client'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Contact } from '../types'

const columnHelper = createColumnHelper<Contact>()

const columns = [
  columnHelper.accessor(
    (row) => `${row.first_name} ${row.last_name}`,
    { id: 'name', header: 'Name' },
  ),
  columnHelper.accessor('email', { header: 'Email' }),
  columnHelper.accessor('phone', { header: 'Phone' }),
  columnHelper.accessor('title', { header: 'Title' }),
  columnHelper.accessor('company', {
    header: 'Company',
    cell: (info) => {
      const co = info.getValue()
      if (!co) return '—'
      return (
        <Link
          href={`/companies/${co.id}`}
          className="text-primary underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {co.name}
        </Link>
      )
    },
  }),
  columnHelper.accessor('created_at', {
    header: 'Created',
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
]

interface ContactTableProps {
  data: Contact[]
  count: number
  page: number
  pageSize: number
}

export function ContactTable({ data, count, page, pageSize }: ContactTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    rowCount: count,
  })

  const setOrdering = (field: string) => {
    const current = searchParams.get('ordering') ?? ''
    const next = current === field ? `-${field}` : field
    const params = new URLSearchParams(searchParams.toString())
    params.set('ordering', next)
    router.replace(`?${params.toString()}`)
  }

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.replace(`?${params.toString()}`)
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium cursor-pointer select-none hover:bg-muted"
                    onClick={() => setOrdering(header.column.id)}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  No contacts found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t cursor-pointer hover:bg-muted/30"
                  onClick={() => router.push(`/contacts/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
