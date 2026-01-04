# Branch Protection Setup

## ✅ Local Protection (Configured)

A pre-push git hook has been installed at `.git/hooks/pre-push` that prevents direct pushes to the `main` branch locally.

**Test it:**
```bash
git checkout main
# Make a change and try to push
git push origin main
# Should show: "❌ ERROR: Direct pushes to 'main' branch are not allowed!"
```

## 🔒 GitHub Branch Protection (Manual Setup Required)

**Note:** Branch protection via API requires GitHub Pro for private repositories. For free accounts, configure it manually through the web UI.

### Manual Setup Steps:

1. **Navigate to Branch Protection Settings**:
   - Direct link: https://github.com/sgedda/mockifyer/settings/branches
   - Or: Repository → Settings → Branches → Add rule

2. **Add Branch Protection Rule**:
   - **Branch name pattern**: `main`
   
3. **Configure Protection Settings**:
   - ✅ **Require a pull request before merging**
     - Require approvals: 1 (or more)
     - Dismiss stale pull request approvals when new commits are pushed
   - ✅ **Require status checks to pass before merging** (optional)
     - Require branches to be up to date before merging
   - ✅ **Do not allow bypassing the above settings**
   - ✅ **Restrict who can push to matching branches** (optional)
     - Only allow specific users/teams with admin access

4. **Save the Rule**:
   - Click "Create" or "Save changes"

### Verification

After setup, try pushing directly to main:
```bash
git push origin main
```

This should be rejected both locally (by the hook) and remotely (by GitHub).

### For GitHub Pro/Enterprise Users

If you upgrade to GitHub Pro, you can use the GitHub CLI:

```bash
gh api repos/sgedda/mockifyer/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":[]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```
