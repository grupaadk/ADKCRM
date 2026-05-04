// Table components using the project design system (.tbl CSS class)

import React from "react"
import { cx } from "./utils"

const TableRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, forwardedRef) => (
  <div ref={forwardedRef} className={cx("overflow-x-auto", className)} {...props}>
    {children}
  </div>
))
TableRoot.displayName = "TableRoot"

const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, forwardedRef) => (
  <table ref={forwardedRef} className={cx("tbl", className)} {...props} />
))
Table.displayName = "Table"

const TableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <thead ref={forwardedRef} className={cx(className)} {...props} />
))
TableHead.displayName = "TableHead"

const TableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, forwardedRef) => (
  <th ref={forwardedRef} className={cx(className)} {...props} />
))
TableHeaderCell.displayName = "TableHeaderCell"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <tbody ref={forwardedRef} className={cx(className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, forwardedRef) => (
  <tr ref={forwardedRef} className={cx(className)} {...props} />
))
TableRow.displayName = "TableRow"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, forwardedRef) => (
  <td ref={forwardedRef} className={cx(className)} {...props} />
))
TableCell.displayName = "TableCell"

const TableFoot = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <tfoot ref={forwardedRef} className={cx(className)} {...props} />
))
TableFoot.displayName = "TableFoot"

export {
  Table,
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
}
