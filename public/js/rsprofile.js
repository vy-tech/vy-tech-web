import { r as rsv } from './chunks/rsvan-ApYzafnY.js';
import { eventBus } from './chunks/eventbus-CgpxZhAr.js';
import { U as UserProfilesData, a as auth } from './chunks/rsauth-dJi3Jae_.js';
import { O as OrganizationsData, o as orgContext } from './chunks/orgContext-BzAEkigY.js';
import { M as Modal } from './chunks/van-ui-YSP0ZuSh.js';
import { v as van } from './chunks/van-t8DywzvC.js';
import './chunks/db-s3IORrbE.js';
import './chunks/index.esm2017-Y6lvFaM5.js';

/**
 * This class manages the user profile and organization interface. It
 * uses a tabbed interface as follows:
 *
 * - Personal Details:
 *  - View and edit personal information (name, email, etc.)
 *  - Change password (if using user/password authentication)
 *
 * - Organization Details:
 *  - List of organizations the user belongs to
 *  - Create new organization
 *  - Delete organization (if user is owner)
 *  - Invite users to an organization via email
 *  - Manage organization roles and permissions
 */
class Profile {
    constructor() {
        this.orgsData = new OrganizationsData();
        this.activeTab = van.state("personal");
        this.user = van.state(null);
        this.profile = van.state(null);
        this.organizations = van.state([]);
        this.saveState = van.state("idle");

        eventBus.addEventListener("signOutClick", () => this.handleSignout());
    }

    init() {
        eventBus.on("auth.unauthenticated", (e) => {
            window.location.href =
                "/users/login?return_url=" +
                encodeURIComponent(window.location.href);
        });

        eventBus.on("auth.ready", (e) => {
            console.log("Profile received auth.ready event", e.detail.user);
            this.user.val = e.detail.user;
            this.checkForInvite();

            if (window.location.hash === "#orgs") {
                this.loadOrganizations().then(
                    () => (this.activeTab.val = "organizations")
                );
            }
        });

        eventBus.on("auth.profileReady", (e) => {
            console.log(
                "Profile received auth.profileReady event",
                e.detail.profile
            );
            this.profile.val = e.detail.profile;
        });

        this.addElements();
    }

    async loadOrganizations() {
        const user = this.user.val;
        if (!user) return;

        const orgs = await this.orgsData.getByUser(user.uid);
        this.organizations.val = orgs || [];

        await orgContext.refreshOrgs();
    }

    addElements(parentElement) {
        const { div, main, h1 } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div(
                    { class: "max-w-4xl mx-auto" },
                    h1(
                        { class: "text-2xl font-bold mb-6 dark:text-white" },
                        "Profile"
                    ),
                    this.createTabNav(),
                    div({ class: "mt-4" }, () =>
                        this.activeTab.val === "personal"
                            ? this.createPersonalTab()
                            : this.createOrganizationsTab()
                    )
                )
            )
        );
    }

    createTabNav() {
        const { div, button } = van.tags;

        const tabButton = (id, label) =>
            button(
                {
                    class: () =>
                        `px-4 py-2 font-medium rounded-t-lg border-b-2 transition-colors ${
                            this.activeTab.val === id
                                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800"
                                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`,
                    onclick: () => {
                        this.activeTab.val = id;
                        if (id === "organizations") {
                            this.loadOrganizations();
                        }
                    },
                },
                label
            );

        return div(
            {
                class: "flex space-x-2 border-b border-gray-200 dark:border-gray-700",
            },
            tabButton("personal", "Personal Details"),
            tabButton("organizations", "Organizations")
        );
    }

    createPersonalTab() {
        const { div, p, label, input } = van.tags;
        const { button } = rsv.tags;

        const user = this.user.val;
        const email = user?.email || "Not signed in";
        const profile = this.profile.val;

        return div(
            { class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6" },

            div(
                { class: "mb-4" },
                p(
                    { class: "text-gray-600 dark:text-gray-400 text-sm" },
                    "Email"
                ),
                p({ class: "dark:text-white" }, email)
            ),

            div(
                { class: "mb-4" },
                label(
                    {
                        for: "displayName",
                        class: "text-gray-600 dark:text-gray-400 text-sm",
                    },
                    "Display Name"
                ),
                div(
                    { class: "flex gap-2 mt-1" },
                    input({
                        type: "text",
                        id: "displayName",
                        value: profile?.displayName || "",
                        class: "flex-1 px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                    })
                )
            ),
            div(
                { class: "mt-6" },
                button(
                    {
                        class: "mr-4",
                        name: "saveProfile",
                        onclick: () => this.handleSaveProfile(),
                        disabled: () => this.saveState.val === "saving",
                    },
                    () => {
                        switch (this.saveState.val) {
                            case "saving":
                                return "Saving...";
                            case "saved":
                                return "Saved ✓";
                            default:
                                return "Save";
                        }
                    }
                ),
                button({ name: "signOut" }, "Sign Out")
            )
        );
    }

    createOrganizationsTab() {
        const { div, h2, p, button, i } = van.tags;

        return div(
            { class: "space-y-4" },
            // Header with create button
            div(
                { class: "flex justify-between items-center" },
                h2(
                    { class: "text-lg font-semibold dark:text-white" },
                    "My Organizations"
                ),
                button(
                    {
                        class: "flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors",
                        onclick: () => this.handleCreateOrg(),
                    },
                    i({ class: "las la-plus" }),
                    "Create Organization"
                )
            ),
            // Organization list
            div({ class: "space-y-3" }, () => {
                const orgs = this.organizations.val;
                if (orgs.length === 0) {
                    return p(
                        {
                            class: "text-gray-500 dark:text-gray-400 text-center py-8",
                        },
                        "You don't belong to any organizations yet."
                    );
                }
                return div(
                    { class: "space-y-3" },
                    ...orgs.map((org) => this.createOrgCard(org))
                );
            })
        );
    }

    createOrgCard(org) {
        const { div, span, button, i } = van.tags;
        const user = this.user.val;
        const isOwner = org.owners?.includes(user?.uid);
        const memberCount = org.members?.length || 0;
        const inviteCount = org.invites?.length || 0;

        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700",
            },
            // Header row
            div(
                { class: "flex justify-between items-start mb-2" },
                div(
                    span(
                        { class: "text-lg font-medium dark:text-white" },
                        org.name
                    ),
                    span(
                        {
                            class: `ml-2 text-xs px-2 py-1 rounded ${
                                isOwner
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            }`,
                        },
                        isOwner ? "Owner" : "Member"
                    )
                )
            ),
            // Stats row
            div(
                { class: "text-sm text-gray-500 dark:text-gray-400 mb-3" },
                `${memberCount} member${memberCount !== 1 ? "s" : ""}`,
                inviteCount > 0
                    ? span(
                          { class: "ml-2" },
                          `• ${inviteCount} pending invite${inviteCount !== 1 ? "s" : ""}`
                      )
                    : null
            ),
            // Actions row
            div(
                { class: "flex gap-2 flex-wrap" },
                isOwner
                    ? [
                          !org.isPersonal
                              ? button(
                                    {
                                        class: "text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                        onclick: () =>
                                            this.showMembersModal(org),
                                    },
                                    i({ class: "las la-users mr-1" }),
                                    "Manage"
                                )
                              : null,
                          !org.isPersonal
                              ? button(
                                    {
                                        class: "text-sm px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded transition-colors",
                                        onclick: () => this.handleInvite(org),
                                    },
                                    i({ class: "las la-envelope mr-1" }),
                                    "Invite"
                                )
                              : null,
                          !org.isPersonal
                              ? button(
                                    {
                                        class: "text-sm px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors",
                                        onclick: () =>
                                            this.handleDeleteOrg(org),
                                    },
                                    i({ class: "las la-trash mr-1" }),
                                    "Delete"
                                )
                              : null,
                      ]
                    : button(
                          {
                              class: "text-sm px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors",
                              onclick: () => this.handleLeaveOrg(org),
                          },
                          i({ class: "las la-sign-out-alt mr-1" }),
                          "Leave"
                      )
            )
        );
    }

    handleCreateOrg() {
        const user = this.user.val;
        if (!user) {
            alert("You must be signed in to create an organization.");
            return;
        }
        this.showCreateOrgModal();
    }

    showCreateOrgModal() {
        const { div, h3, label, input, p, button } = van.tags;
        const closed = van.state(false);
        const creating = van.state(false);
        const error = van.state(null);

        const handleCreate = async () => {
            const name = document.getElementById("orgName").value.trim();
            if (!name) {
                error.val = "Organization name is required";
                return;
            }
            creating.val = true;
            error.val = null;
            try {
                const user = this.user.val;
                await this.orgsData.create(name, user.uid);
                await this.loadOrganizations();
                closed.val = true;
            } catch (err) {
                console.error("Error creating organization:", err);
                error.val = "Failed to create organization";
                creating.val = false;
            }
        };

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-md" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full",
                    },
                    h3(
                        { class: "text-lg font-semibold mb-4 dark:text-white" },
                        "Create Organization"
                    ),
                    div(
                        { class: "mb-4" },
                        label(
                            {
                                for: "orgName",
                                class: "block text-sm text-gray-600 dark:text-gray-400 mb-1",
                            },
                            "Organization Name"
                        ),
                        input({
                            type: "text",
                            id: "orgName",
                            placeholder: "Enter organization name",
                            class: "w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                        })
                    ),
                    () =>
                        error.val
                            ? p(
                                  {
                                      class: "text-red-600 dark:text-red-400 mb-4 text-sm",
                                  },
                                  error.val
                              )
                            : null,
                    div(
                        { class: "flex justify-end gap-2" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: () => (closed.val = true),
                            },
                            "Cancel"
                        ),
                        button(
                            {
                                class: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors",
                                onclick: handleCreate,
                                disabled: () => creating.val,
                            },
                            () => (creating.val ? "Creating..." : "Create")
                        )
                    )
                )
            )
        );
    }

    async handleInvite(org) {
        const token = await this.orgsData.createInvite(org.id);
        const baseUrl = window.location.origin;
        const inviteUrl = `${baseUrl}/profile/acceptInvite/${token}?name=${encodeURIComponent(org.name)}`;

        this.showInviteLinkModal(inviteUrl);
        await this.loadOrganizations();
    }

    showInviteLinkModal(inviteUrl) {
        const { div, h3, p, input, button, i, span } = van.tags;
        const closed = van.state(false);
        const copied = van.state(false);

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-md" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full",
                    },
                    h3(
                        {
                            class: "text-lg font-semibold mb-4 dark:text-white",
                        },
                        "Invite Link Created"
                    ),
                    p(
                        {
                            class: "text-sm text-gray-600 dark:text-gray-400 mb-4",
                        },
                        "Share this link with the person you want to invite:"
                    ),
                    div(
                        { class: "flex gap-2 mb-4" },
                        input({
                            type: "text",
                            value: inviteUrl,
                            readonly: true,
                            class: "flex-1 px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm",
                        }),
                        button(
                            {
                                class: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors",
                                onclick: async () => {
                                    await navigator.clipboard.writeText(
                                        inviteUrl
                                    );
                                    copied.val = true;
                                    setTimeout(
                                        () => (copied.val = false),
                                        2000
                                    );
                                },
                            },
                            () =>
                                copied.val
                                    ? span(
                                          i({ class: "las la-check" }),
                                          " Copied!"
                                      )
                                    : span(i({ class: "las la-copy" }), " Copy")
                        )
                    ),
                    div(
                        { class: "flex justify-end" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: () => (closed.val = true),
                            },
                            "Close"
                        )
                    )
                )
            )
        );
    }

    showMembersModal(org) {
        const { div, h3, p, span, button } = van.tags;
        const closed = van.state(false);
        const members = van.state([...org.members]);
        const owners = van.state([...org.owners]);
        const invites = van.state([...org.invites]);
        const memberProfiles = van.state({});
        const user = this.user.val;

        const loadProfiles = async (memberIds) => {
            const upd = new UserProfilesData();
            const profiles = await upd.getByIds(memberIds);
            console.log("Loaded member profiles:", profiles);
            const profileMap = {};
            profiles.forEach((p) => {
                profileMap[p.id] = p.displayName;
            });
            memberProfiles.val = profileMap;
        };

        // Fetch profiles on modal open
        loadProfiles(org.members);

        const refreshOrg = async () => {
            const updated = await this.orgsData.getById(org.id);
            members.val = [...updated.members];
            owners.val = [...updated.owners];
            invites.val = [...updated.invites];
            await loadProfiles(updated.members);
            await this.loadOrganizations();
        };

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-2xl" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto",
                    },
                    h3(
                        {
                            class: "text-lg font-semibold mb-4 dark:text-white",
                        },
                        `Manage Members - ${org.name}`
                    ),
                    div({ class: "space-y-2 mb-4" }, () =>
                        div(
                            members.val.map((memberId) => {
                                const isOwner = owners.val.includes(memberId);
                                const isSelf = memberId === user?.uid;

                                return div(
                                    {
                                        class: "flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded",
                                    },
                                    div(
                                        span(
                                            { class: "dark:text-white" },
                                            () =>
                                                memberProfiles.val[memberId] ||
                                                memberId
                                        ),
                                        span(
                                            {
                                                class: `ml-2 text-xs px-2 py-0.5 rounded ${
                                                    isOwner
                                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                                        : "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                                                }`,
                                            },
                                            isOwner ? "Owner" : "Member"
                                        ),
                                        isSelf
                                            ? span(
                                                  {
                                                      class: "ml-2 text-xs text-blue-500",
                                                  },
                                                  "(you)"
                                              )
                                            : null
                                    ),
                                    !isSelf
                                        ? div(
                                              { class: "flex gap-1" },
                                              isOwner
                                                  ? button(
                                                        {
                                                            class: "text-xs px-2 py-1 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded",
                                                            onclick:
                                                                async () => {
                                                                    await this.orgsData.removeOwner(
                                                                        org.id,
                                                                        memberId
                                                                    );
                                                                    await refreshOrg();
                                                                },
                                                        },
                                                        "Demote"
                                                    )
                                                  : button(
                                                        {
                                                            class: "text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-300 rounded",
                                                            onclick:
                                                                async () => {
                                                                    await this.orgsData.addOwner(
                                                                        org.id,
                                                                        memberId
                                                                    );
                                                                    await refreshOrg();
                                                                },
                                                        },
                                                        "Promote"
                                                    ),
                                              button(
                                                  {
                                                      class: "text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded",
                                                      onclick: async () => {
                                                          if (
                                                              !confirm(
                                                                  `Remove ${memberId} from the organization?`
                                                              )
                                                          )
                                                              return;
                                                          await this.orgsData.removeMember(
                                                              org.id,
                                                              memberId
                                                          );
                                                          await refreshOrg();
                                                      },
                                                  },
                                                  "Remove"
                                              )
                                          )
                                        : null
                                );
                            })
                        )
                    ),
                    // Pending invites section
                    () =>
                        invites.val?.length > 0
                            ? div(
                                  { class: "mb-4" },
                                  p(
                                      {
                                          class: "text-sm font-medium text-gray-600 dark:text-gray-400 mb-2",
                                      },
                                      "Pending Invites"
                                  ),
                                  div(
                                      { class: "space-y-1" },
                                      ...invites.val.map((token) =>
                                          div(
                                              {
                                                  class: "flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm",
                                              },
                                              span(
                                                  {
                                                      class: "font-mono text-xs text-gray-600 dark:text-gray-400",
                                                  },
                                                  token.substring(0, 12) + "..."
                                              ),
                                              button(
                                                  {
                                                      class: "text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded",
                                                      onclick: async () => {
                                                          await this.orgsData.revokeInvite(
                                                              org.id,
                                                              token
                                                          );
                                                          await refreshOrg();
                                                      },
                                                  },
                                                  "Revoke"
                                              )
                                          )
                                      )
                                  )
                              )
                            : null,
                    div(
                        { class: "flex justify-end" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: () => (closed.val = true),
                            },
                            "Close"
                        )
                    )
                )
            )
        );
    }

    async handleDeleteOrg(org) {
        if (
            !confirm(
                `Are you sure you want to delete "${org.name}"? This cannot be undone.`
            )
        )
            return;

        await this.orgsData.delete(org.id);
        await this.loadOrganizations();
    }

    async handleLeaveOrg(org) {
        if (!confirm(`Are you sure you want to leave "${org.name}"?`)) return;

        const user = this.user.val;
        if (!user) return;

        await this.orgsData.removeMember(org.id, user.uid);
        await this.loadOrganizations();
    }

    checkForInvite() {
        const path = window.location.pathname;
        const match = path.match(/^\/profile\/acceptInvite\/(.+)$/);
        if (match) {
            const token = match[1];
            const params = new URLSearchParams(window.location.search);
            const orgName = params.get("name") || "an organization";
            this.showAcceptInviteModal(token, orgName);
        }
    }

    showAcceptInviteModal(token, orgName) {
        const { div, h3, p, button } = van.tags;
        const closed = van.state(false);
        const error = van.state(null);
        const accepting = van.state(false);

        const handleAccept = async () => {
            accepting.val = true;
            try {
                const user = this.user.val;
                const idToken = await user.getIdToken(true);

                const response = await fetch(`/api/org/accept/${token}`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (response.ok) {
                    closed.val = true;
                    window.history.replaceState({}, "", "/profile");
                    await this.loadOrganizations();
                    this.activeTab.val = "organizations";
                } else {
                    error.val =
                        "Failed to join organization. The invite may be invalid or expired.";
                }
            } catch (err) {
                console.error("Error accepting invite:", err);
                error.val = "Failed to join organization";
            }
            accepting.val = false;
        };

        const handleDecline = () => {
            closed.val = true;
            window.history.replaceState({}, "", "/profile");
        };

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-md" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full",
                    },
                    h3(
                        { class: "text-lg font-semibold mb-4 dark:text-white" },
                        "Join Organization"
                    ),
                    p(
                        { class: "text-gray-600 dark:text-gray-400 mb-4" },
                        `You've been invited to join "${orgName}".`
                    ),
                    () =>
                        error.val
                            ? p(
                                  {
                                      class: "text-red-600 dark:text-red-400 mb-4",
                                  },
                                  error.val
                              )
                            : null,
                    div(
                        { class: "flex justify-end gap-2" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: handleDecline,
                            },
                            "Decline"
                        ),
                        button(
                            {
                                class: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors",
                                onclick: handleAccept,
                                disabled: () => accepting.val,
                            },
                            () => (accepting.val ? "Joining..." : "Accept")
                        )
                    )
                )
            )
        );
    }

    async handleSaveProfile() {
        const user = this.user.val;
        if (!user) return;

        const upd = new UserProfilesData();
        const displayName = document.getElementById("displayName").value;

        this.saveState.val = "saving";
        await upd.update(user.uid, { displayName });

        this.profile.val = { ...this.profile.val, displayName };
        this.saveState.val = "saved";
        setTimeout(() => {
            this.saveState.val = "idle";
        }, 2000);
    }

    handleSignout() {
        auth.signOut();
    }
}

const profile = new Profile();

export { Profile, profile };
//# sourceMappingURL=rsprofile.js.map
