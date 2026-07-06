export const PrivacyUserDataSection = () => (
    <section>
        <div className="bold">
            User Data
        </div>
        <ul>
            <li>
                When you search, your query is stored as a vector embedding in order to speed up similar searches in the future.
                There might eventually be a feature to show suggested search queries, which will use these embeddings and may show users your exact query.
                Please don't type anything sensitive into the search query box.
            </li>
            <li>
                Reviews (number ratings and textual comments) are stored and shown to other users. You can delete them at any time.
            </li>
            <li>
                When you sign in, your 3rd-party user id is stored alongside your display name from that 3rd-party service.
                You can change your display name at any time on your profile page.
                Please don't put anything inappropriate as your display name. Emoji is ok.
            </li>
        </ul>
    </section>
);
