import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface IScrollAnchorProps {
    id: string;
}

export const ScrollAnchor: React.FC<IScrollAnchorProps> = ({ id }) => {
    const [element, setElement] = useState<HTMLAnchorElement | null>();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (element == null) {
            return;
        }

        if (location.hash !== `#${id}`) {
            return;
        }

        // Jump to hash after render
        setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });

            // Remove hash from URL after jumping
            const url = new URL(window.location.href);
            url.hash = '';

            navigate(url.pathname);
        }, 0);
    }, [navigate, id, element, location.hash]);

    return (
        <a className="scroll-anchor" href={`#${id}`} ref={setElement}/>
    );
}