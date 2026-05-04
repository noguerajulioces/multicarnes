# Release smoke checklist

Run this entire list on every release candidate, on every supported OS. All items must pass before sign-off.

> Time budget: ~20 min per OS.

| App version |       |
| ----------- | ----- |
| OS          |       |
| Date        |       |
| Tester      |       |

## Install & launch

- [ ] Installer runs without admin errors.
- [ ] App launches and shows the login screen.
- [ ] App version in footer / About matches the installer.
- [ ] Window remembers size/position after restart.

## Authentication

- [ ] Login with valid admin credentials works.
- [ ] Login with wrong password shows a clear error.
- [ ] Logout returns to login screen and clears session.

## Products

- [ ] Open Products module — list loads without errors.
- [ ] Create a new product (name, price, stock, category, barcode).
- [ ] Edit the product and save.
- [ ] Search by name and by barcode returns the product.

## Cash session

- [ ] Open a new cash session with an opening amount.
- [ ] Cash status indicator shows "Open".
- [ ] Cannot open a second session while one is open.

## Sales (core flow)

- [ ] Add a product by clicking it.
- [ ] Add a product by scanning / typing the barcode.
- [ ] Change quantity and apply line discount.
- [ ] Select a customer.
- [ ] Choose payment method, register cash received, see change due.
- [ ] Confirm sale — ticket prints (or PDF preview if no printer).
- [ ] Sale appears in the sales history.
- [ ] Stock decreases for the sold products.

## Cash close

- [ ] Close the cash session with a counted amount.
- [ ] Difference vs. expected is shown correctly.
- [ ] Closed session appears in the cash history.

## Reports

- [ ] Sales report for "today" shows the sale just made.
- [ ] Date range filter works (yesterday returns 0 if fresh DB).
- [ ] Export to PDF / Excel produces a valid file.

## Backup

- [ ] Manual backup creates a file at the chosen location.
- [ ] Restore from backup repopulates the data after a wipe.

## Stability

- [ ] No JS errors in the console during the run.
- [ ] No unhandled exceptions / crash dialogs.
- [ ] App closes cleanly with no zombie processes.

## Sign-off

- [ ] All P1 items pass — release is **GO**.
- [ ] Failing items filed as bugs with IDs: ____________________
